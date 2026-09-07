import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IAppointmentRepository, APPOINTMENT_REPOSITORY } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationType } from '@prisma/client';

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(tenantId: string, id: string, reason: string, userId?: string): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    if (!app.canCancel()) {
      throw new BadRequestException('Tamamlanmış veya zaten iptal edilmiş randevular iptal edilemez.');
    }

    const cancelled = await this.appointmentRepository.cancelAppointmentAndWorkOrder(tenantId, id, reason);

    this.eventsGateway.emitToTenant(tenantId, 'appointment:cancelled', {
      id,
      reason,
      appointment: cancelled,
    });

    await this.notificationsService.createNotification({
      tenantId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      type: NotificationType.WARNING,
      category: 'APPOINTMENT',
      title: 'Randevu İptal Edildi',
      message: `Bir randevu iptal edildi. Neden: ${reason}`,
      link: '/appointments',
      metadata: { appointmentId: id, reason },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.cancelled',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: app.status },
      changesAfter: { status: 'CANCELLED', cancellationReason: reason },
    });

    return cancelled;
  }
}
