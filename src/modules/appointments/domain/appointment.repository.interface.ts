import { AppointmentEntity } from './appointment.entity';

export const APPOINTMENT_REPOSITORY = 'IAppointmentRepository';

export interface IAppointmentRepository {
  findById(tenantId: string, id: string): Promise<AppointmentEntity | null>;
  findAll(tenantId: string, date?: string): Promise<AppointmentEntity[]>;
  create(appointment: AppointmentEntity): Promise<AppointmentEntity>;
  save(appointment: AppointmentEntity): Promise<AppointmentEntity>;
  checkMechanicConflict(
    tenantId: string,
    mechanicId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean>;
  checkLiftConflict(
    tenantId: string,
    lift: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean>;
  cancelAppointmentAndWorkOrder(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<AppointmentEntity>;
  findTenantBySlug(slug: string): Promise<any | null>;
  findActiveOnlineBays(tenantId: string): Promise<string[]>;
  findOrCreateCustomerForPublic(
    tenantId: string,
    name: string,
    phone: string,
  ): Promise<any>;
  findOrCreateVehicleForPublic(
    tenantId: string,
    customerId: string,
    plate: string,
    brandModel?: string,
  ): Promise<any>;
}
