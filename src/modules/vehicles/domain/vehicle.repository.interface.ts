import { VehicleEntity } from './vehicle.entity';

export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');

export interface FindVehiclesOptions {
  search?: string;
  customerId?: string;
}

export interface IVehicleRepository {
  findById(tenantId: string, id: string): Promise<VehicleEntity | null>;
  findByPlate(tenantId: string, plate: string): Promise<VehicleEntity | null>;
  findAll(tenantId: string, options?: FindVehiclesOptions): Promise<VehicleEntity[]>;
  save(vehicle: VehicleEntity): Promise<VehicleEntity>;
  update(vehicle: VehicleEntity): Promise<VehicleEntity>;
  softDelete(tenantId: string, id: string): Promise<void>;
}
