export type AppointmentStatusType =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AppointmentProps {
  id?: string;
  tenantId: string;
  customerId: string;
  vehicleId: string;
  serviceId?: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  slotDate: Date;
  slotStartTime: Date;
  slotEndTime: Date;
  status?: AppointmentStatusType;
  customerNotes?: string;
  cancellationReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
  customer?: any;
  vehicle?: any;
  service?: any;
  assignedMechanic?: any;
  workOrder?: any;
}

export class AppointmentEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly customerId: string;
  public readonly vehicleId: string;
  public serviceId?: string;
  public assignedMechanicId?: string;
  public assignedLift?: string;
  public slotDate: Date;
  public slotStartTime: Date;
  public slotEndTime: Date;
  public status: AppointmentStatusType;
  public customerNotes?: string;
  public cancellationReason?: string;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public customer?: any;
  public vehicle?: any;
  public service?: any;
  public assignedMechanic?: any;
  public workOrder?: any;

  constructor(props: AppointmentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.vehicleId = props.vehicleId;
    this.serviceId = props.serviceId;
    this.assignedMechanicId = props.assignedMechanicId;
    this.assignedLift = props.assignedLift;
    this.slotDate = props.slotDate;
    this.slotStartTime = props.slotStartTime;
    this.slotEndTime = props.slotEndTime;
    this.status = props.status || 'PENDING';
    this.customerNotes = props.customerNotes;
    this.cancellationReason = props.cancellationReason;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.customer = props.customer;
    this.vehicle = props.vehicle;
    this.service = props.service;
    this.assignedMechanic = props.assignedMechanic;
    this.workOrder = props.workOrder;
  }

  public canCancel(): boolean {
    return this.status !== 'COMPLETED' && this.status !== 'CANCELLED';
  }

  public cancel(reason?: string): void {
    if (!this.canCancel()) {
      throw new Error('Tamamlanmış veya zaten iptal edilmiş randevu iptal edilemez.');
    }
    this.status = 'CANCELLED';
    this.cancellationReason = reason;
  }

  public canReschedule(): boolean {
    return this.status !== 'COMPLETED' && this.status !== 'CANCELLED';
  }

  public reschedule(
    slotDate: Date,
    slotStartTime: Date,
    slotEndTime: Date,
    mechanicId?: string,
    lift?: string,
  ): void {
    if (!this.canReschedule()) {
      throw new Error('Tamamlanmış veya iptal edilmiş randevu yeniden planlanamaz.');
    }
    this.slotDate = slotDate;
    this.slotStartTime = slotStartTime;
    this.slotEndTime = slotEndTime;
    if (mechanicId !== undefined) this.assignedMechanicId = mechanicId;
    if (lift !== undefined) this.assignedLift = lift;
  }

  public confirm(): void {
    if (this.status === 'CANCELLED') {
      throw new Error('İptal edilmiş randevu onaylanamaz.');
    }
    this.status = 'CONFIRMED';
  }

  public markNoShow(): void {
    if (this.status === 'COMPLETED' || this.status === 'CANCELLED') {
      throw new Error('Geçersiz durum geçişi.');
    }
    this.status = 'NO_SHOW';
  }
}
