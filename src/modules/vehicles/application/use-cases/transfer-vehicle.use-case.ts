import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  IVehicleRepository,
  VEHICLE_REPOSITORY,
} from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';

@Injectable()
export class TransferVehicleUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(
    tenantId: string,
    vehicleId: string,
    newCustomerId: string,
  ): Promise<VehicleEntity> {
    if (!vehicleId || !newCustomerId) {
      throw new BadRequestException('Araç ID ve yeni Müşteri ID zorunludur.');
    }
    return this.vehicleRepository.transferOwnership(
      tenantId,
      vehicleId,
      newCustomerId,
    );
  }

  async checkPlate(tenantId: string, rawPlate: string) {
    const normalizedPlate = VehicleEntity.normalizePlate(rawPlate);
    if (!normalizedPlate) {
      return { exists: false };
    }

    const vehicle = await this.vehicleRepository.findByPlateAny(
      tenantId,
      normalizedPlate,
    );

    if (!vehicle) {
      return { exists: false };
    }

    const isDeleted = vehicle.deletedAt !== null;
    const customer = vehicle.customer;
    const isCustomerDeleted = customer ? customer.deletedAt !== null : false;

    let ownerName = 'Bilinmeyen Müşteri';
    if (customer) {
      if (customer.companyTitle) {
        ownerName = customer.companyTitle;
      } else {
        ownerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Müşteri';
      }
    }

    return {
      exists: true,
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      customerId: vehicle.customerId,
      ownerName,
      ownerPhone: customer?.phone,
      isVehicleDeleted: isDeleted,
      isCustomerDeleted,
    };
  }
}
