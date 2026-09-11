import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { QueueService } from '../../../queues/queue.service';
import { NotificationType } from '@prisma/client';

export interface CreateAppointmentInput {
  customerId: string;
  vehicleId: string;
  serviceId?: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  customerNotes?: string;
}

@Injectable()
export class CreateAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
    private readonly queueService: QueueService,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateAppointmentInput,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

    const preliminaryEntity = new AppointmentEntity({
      tenantId,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      slotDate: new Date(dto.slotDate),
      slotStartTime: start,
      slotEndTime: end,
    });

    if (!preliminaryEntity.isValidSlot()) {
      throw new BadRequestException(
        'Randevu bitiş saati başlangıç saatinden sonra olmalıdır.',
      );
    }

    const now = new Date();
    // Allow up to 2 minutes grace period for network/form submission latency
    if (start.getTime() < now.getTime() - 2 * 60 * 1000) {
      throw new BadRequestException(
        'Geçmiş bir tarih veya saate randevu oluşturulamaz.',
      );
    }

    // Concurrency Check 1: Mechanic Double Booking Prevention
    if (dto.assignedMechanicId) {
      const mechanicConflict =
        await this.appointmentRepository.checkMechanicConflict(
          tenantId,
          dto.assignedMechanicId,
          start,
          end,
        );

      if (mechanicConflict) {
        throw new ConflictException(
          'Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.',
        );
      }
    }

    // Concurrency Check 2: Lift Double Booking Prevention
    if (dto.assignedLift) {
      const liftConflict = await this.appointmentRepository.checkLiftConflict(
        tenantId,
        dto.assignedLift,
        start,
        end,
      );

      if (liftConflict) {
        throw new ConflictException(
          `"${dto.assignedLift}" için bu saat aralığında başka bir randevu bulunmaktadır.`,
        );
      }
    }

    const entity = new AppointmentEntity({
      tenantId,
      customerId: dto.customerId,
      vehicleId: dto.vehicleId,
      serviceId: dto.serviceId || undefined,
      assignedMechanicId: dto.assignedMechanicId || undefined,
      assignedLift: dto.assignedLift || undefined,
      slotDate: new Date(dto.slotDate),
      slotStartTime: start,
      slotEndTime: end,
      customerNotes: dto.customerNotes || undefined,
      status: 'CONFIRMED',
    });

    const created = await this.appointmentRepository.create(entity);

    // Realtime Socket Event
    this.eventsGateway.emitToTenant(tenantId, 'appointment:created', created);

    // In-app Notification
    await this.notificationsService.createNotification({
      tenantId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      type: NotificationType.INFO,
      category: 'APPOINTMENT',
      title: 'Yeni Randevu Oluşturuldu',
      message: `${created.slotDate ? new Date(created.slotDate).toLocaleDateString('tr-TR') : ''} tarihine yeni randevu kaydı oluşturuldu.`,
      link: '/appointments',
      metadata: { appointmentId: created.id },
    });

    // Schedule 2-Hour Prior SMS Reminder via BullMQ
    const reminderTime = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    const delay = reminderTime.getTime() - Date.now();
    if (delay > 0 && created.id) {
      await this.queueService.scheduleAppointmentReminder(created.id, delay, {
        tenantId,
        slotStartTime: start.toISOString(),
      });
    }

    // Audit Log
    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.created',
      entityName: 'Appointment',
      entityId: created.id,
      changesAfter: {
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        slotDate: dto.slotDate,
        slotStartTime: dto.slotStartTime,
        slotEndTime: dto.slotEndTime,
        assignedMechanicId: dto.assignedMechanicId,
        assignedLift: dto.assignedLift,
      },
    });

    return created;
  }
}
