import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { IAppointmentRepository, APPOINTMENT_REPOSITORY } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationType } from '@prisma/client';

export interface CreatePublicAppointmentInput {
  customerName: string;
  customerPhone: string;
  plate: string;
  brandModel?: string;
  serviceId?: string;
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  customerNotes?: string;
}

@Injectable()
export class CreatePublicAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(slug: string, dto: CreatePublicAppointmentInput): Promise<AppointmentEntity> {
    const tenant = await this.appointmentRepository.findTenantBySlug(slug);
    if (!tenant) {
      throw new NotFoundException('İlgili işletme bulunamadı veya online randevu kapalı.');
    }

    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

    // Conflict check (Lift 1 default)
    const liftConflict = await this.appointmentRepository.checkLiftConflict(
      tenant.id,
      'Lift 1 (Hızlı Kabul)',
      start,
      end,
    );

    if (liftConflict) {
      throw new ConflictException('Seçilen saat aralığı doludur. Lütfen farklı bir saat dilimi seçiniz.');
    }

    const customer = await this.appointmentRepository.findOrCreateCustomerForPublic(
      tenant.id,
      dto.customerName,
      dto.customerPhone,
    );

    const vehicle = await this.appointmentRepository.findOrCreateVehicleForPublic(
      tenant.id,
      customer.id,
      dto.plate,
      dto.brandModel,
    );

    const entity = new AppointmentEntity({
      tenantId: tenant.id,
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: dto.serviceId || undefined,
      assignedLift: 'Lift 1 (Hızlı Kabul)',
      slotDate: new Date(dto.slotDate),
      slotStartTime: start,
      slotEndTime: end,
      customerNotes: dto.customerNotes || undefined,
      status: 'PENDING',
    });

    const created = await this.appointmentRepository.create(entity);

    this.eventsGateway.emitToTenant(tenant.id, 'appointment:public_created', created);

    await this.notificationsService.createNotification({
      tenantId: tenant.id,
      targetRoles: ['OWNER', 'SERVICE_MANAGER'],
      type: NotificationType.INFO,
      category: 'APPOINTMENT',
      title: 'Yeni Online Müşteri Randevusu',
      message: `${dto.customerName} (${dto.plate}) online randevu talebinde bulundu (${dto.slotDate}).`,
      link: '/appointments',
      metadata: { appointmentId: created.id, source: 'PUBLIC_BOOKING' },
    });

    return created;
  }
}
