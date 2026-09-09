import { Injectable, Inject } from '@nestjs/common';
import { IVehicleRepository, VEHICLE_REPOSITORY, FindVehiclesOptions } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';

@Injectable()
export class GetVehiclesUseCase {
  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: IVehicleRepository,
  ) {}

  async execute(tenantId: string, options?: FindVehiclesOptions): Promise<VehicleEntity[]> {
    return this.vehicleRepository.findAll(tenantId, options);
  }
}
