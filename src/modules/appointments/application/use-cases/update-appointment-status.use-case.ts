import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationType } from '@prisma/client';

@Injectable()
export class UpdateAppointmentStatusUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async approve(
    tenantId: string,
    id: string,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    app.confirm();
    const updated = await this.appointmentRepository.save(app);

    this.eventsGateway.emitToTenant(tenantId, 'appointment:approved', updated);

    await this.notificationsService.createNotification({
      tenantId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      type: NotificationType.SUCCESS,
      category: 'APPOINTMENT',
      title: 'Randevu Onaylandı',
      message: `${updated.slotDate ? new Date(updated.slotDate).toLocaleDateString('tr-TR') : ''} tarihli randevu onaylandı.`,
      link: '/appointments',
      metadata: { appointmentId: id },
    });

    if (app.customer?.phone) {
      const formattedDate = app.slotStartTime
        ? new Date(app.slotStartTime).toLocaleDateString('tr-TR')
        : '';
      const formattedTime = app.slotStartTime
        ? new Date(app.slotStartTime).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.SUCCESS,
        category: 'APPOINTMENT',
        title: 'Randevunuz Onaylandı',
        message: `Sayın ${app.customer.firstName || 'Müşterimiz'}, ${formattedDate} ${formattedTime} randevunuz onaylanmıştır.`,
        recipientPhone: app.customer.phone,
        sendSms: true,
      });
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.approved',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: 'PENDING' },
      changesAfter: { status: 'CONFIRMED' },
    });

    return updated;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: string,
    cancellationReason?: string,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    const oldStatus = app.status;
    app.status = status as any;
    if (cancellationReason) {
      app.cancellationReason = cancellationReason;
    }

    const updated = await this.appointmentRepository.save(app);

    this.eventsGateway.emitToTenant(
      tenantId,
      'appointment:status_changed',
      updated,
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.status_changed',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: oldStatus },
      changesAfter: { status, cancellationReason },
    });

    return updated;
  }

  async markNoShow(
    tenantId: string,
    id: string,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    const oldStatus = app.status;
    app.markNoShow();
    const updated = await this.appointmentRepository.save(app);

    this.eventsGateway.emitToTenant(tenantId, 'appointment:no_show', updated);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.no_show',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: oldStatus },
      changesAfter: { status: 'NO_SHOW' },
    });

    return updated;
  }
}
