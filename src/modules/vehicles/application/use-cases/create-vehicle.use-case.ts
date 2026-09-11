import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  IVehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../domain/vehicle.repository.interface';
import {
  VehicleEntity,
  VehicleFuelType,
  VehicleTransmissionType,
} from '../../domain/vehicle.entity';

export interface CreateVehicleInput {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
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
export class CreateVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateVehicleInput,
  ): Promise<VehicleEntity> {
    const normalizedPlate = VehicleEntity.normalizePlate(dto.plate);
    if (!normalizedPlate) {
      throw new BadRequestException('Araç plakası zorunludur.');
    }

    const existing = await this.vehicleRepository.findByPlate(
      tenantId,
      normalizedPlate,
    );
    if (existing) {
      throw new ConflictException(
        'Bu plaka ile kayıtlı bir araç zaten mevcut.',
      );
    }

    try {
      const entity = new VehicleEntity({
        tenantId,
        customerId: dto.customerId,
        plate: normalizedPlate,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        vin: dto.vin,
        engineNo: dto.engineNo,
        color: dto.color,
        fuelType: dto.fuelType,
        transmission: dto.transmission,
        currentKm: dto.currentKm,
        inspectionValidUntil: dto.inspectionValidUntil,
        insuranceValidUntil: dto.insuranceValidUntil,
        kaskoValidUntil: dto.kaskoValidUntil,
      });

      return await this.vehicleRepository.save(entity);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Geçersiz araç bilgisi.');
    }
  }
}
