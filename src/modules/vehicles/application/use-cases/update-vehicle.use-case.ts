import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { IVehicleRepository, VEHICLE_REPOSITORY } from '../../domain/vehicle.repository.interface';
import { VehicleEntity, VehicleFuelType, VehicleTransmissionType } from '../../domain/vehicle.entity';

export interface UpdateVehicleInput {
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  vin?: string;
  engineNo?: string;
  color?: string;
  fuelType?: VehicleFuelType;
  transmission?: VehicleTransmissionType;
  currentKm?: number;
  inspectionValidUntil?: Date;
  insuranceValidUntil?: Date;
  kaskoValidUntil?: Date;
}

@Injectable()
export class UpdateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(tenantId: string, id: string, dto: UpdateVehicleInput): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepository.findById(tenantId, id);
    if (!vehicle) {
      throw new NotFoundException('Araç bulunamadı.');
    }

    if (dto.plate) {
      const normalizedPlate = VehicleEntity.normalizePlate(dto.plate);
      const existing = await this.vehicleRepository.findByPlate(tenantId, normalizedPlate);
      if (existing && existing.id !== id) {
        throw new ConflictException('Bu plaka ile kayıtlı başka bir araç zaten mevcut.');
      }
    }

    try {
      vehicle.updateDetails(dto);
      return await this.vehicleRepository.update(vehicle);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Araç güncellenirken geçersiz veri tespit edildi.');
    }
  }
}
