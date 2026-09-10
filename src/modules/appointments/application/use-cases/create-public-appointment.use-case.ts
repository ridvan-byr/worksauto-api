import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Geçersiz randevu saat aralığı. Bitiş saati başlangıçtan sonra olmalıdır.');
    }

    const now = new Date();
    // Allow up to 2 minutes grace period for network latency
    if (start.getTime() < now.getTime() - 2 * 60 * 1000) {
      throw new BadRequestException('Geçmiş bir tarih veya saate randevu oluşturulamaz.');
    }

    // Dynamic Lift Bay Allocation: fetch tenant's active online bays or fallback to standard intake bays
    const onlineBays = await this.appointmentRepository.findActiveOnlineBays(tenant.id);
    const bays = onlineBays.length > 0 ? onlineBays : ['Lift 1 (Hızlı Kabul)', 'Lift 2 (Mekanik)', 'Kabul Alanı'];
    let assignedLift: string | null = null;

    for (const bay of bays) {
      const conflict = await this.appointmentRepository.checkLiftConflict(
        tenant.id,
        bay,
        start,
        end,
      );
      if (!conflict) {
        assignedLift = bay;
        break;
      }
    }

    if (!assignedLift) {
      throw new ConflictException('Seçilen saat aralığında tüm servis kabul alanları doludur. Lütfen farklı bir saat dilimi seçiniz.');
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
      assignedLift,
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
