import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationType } from '@prisma/client';

import { NotificationTemplateService } from '../../../notifications/services/notification-template.service';

export interface RescheduleAppointmentInput {
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  assignedMechanicId?: string;
  assignedLift?: string;
  reason?: string;
  notifyCustomer?: boolean;
  channels?: ('WHATSAPP' | 'SMS' | 'EMAIL')[];
}

@Injectable()
export class RescheduleAppointmentUseCase {
  private readonly templateService: NotificationTemplateService;

  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
    templateService?: NotificationTemplateService,
  ) {
    this.templateService = templateService || new NotificationTemplateService();
  }

  async execute(
    tenantId: string,
    id: string,
    dto: RescheduleAppointmentInput,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    if (!app.canReschedule()) {
      throw new BadRequestException(
        'Tamamlanmış veya iptal edilmiş randevular yeniden planlanamaz.',
      );
    }

    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

    const now = new Date();
    // Allow up to 2 minutes grace period for network latency
    if (start.getTime() < now.getTime() - 2 * 60 * 1000) {
      throw new BadRequestException(
        'Geçmiş bir tarih veya saate randevu yeniden planlanamaz.',
      );
    }

    const mechanicId =
      dto.assignedMechanicId !== undefined
        ? dto.assignedMechanicId
        : app.assignedMechanicId;
    const lift =
      dto.assignedLift !== undefined ? dto.assignedLift : app.assignedLift;

    if (mechanicId) {
      const onLeave = await this.appointmentRepository.checkMechanicOnLeave(
        tenantId,
        mechanicId,
        start,
      );
      if (onLeave) {
        throw new ConflictException(
          'Seçilen teknisyen randevu tarihinde izinli veya raporludur.',
        );
      }

      const conflict = await this.appointmentRepository.checkMechanicConflict(
        tenantId,
        mechanicId,
        start,
        end,
        id,
      );
      if (conflict) {
        throw new ConflictException(
          'Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.',
        );
      }
    }

    if (lift) {
      const conflict = await this.appointmentRepository.checkLiftConflict(
        tenantId,
        lift,
        start,
        end,
        id,
      );
      if (conflict) {
        throw new ConflictException(
          `"${lift}" için bu saat aralığında başka bir randevu bulunmaktadır.`,
        );
      }
    }

    const oldDate = app.slotDate;
    const oldStart = app.slotStartTime;

    app.reschedule(
      new Date(dto.slotDate),
      start,
      end,
      dto.assignedMechanicId,
      dto.assignedLift,
    );
    const updated = await this.appointmentRepository.save(app);

    this.eventsGateway.emitToTenant(
      tenantId,
      'appointment:rescheduled',
      updated,
    );

    const details = this.appointmentRepository.getNotificationContext
      ? await this.appointmentRepository
          .getNotificationContext(tenantId, app.customerId, app.vehicleId)
          .catch(() => null)
      : null;

    const customerName =
      details?.customerName ||
      `${app.customer?.firstName || ''} ${app.customer?.lastName || ''}`.trim() ||
      'Değerli Müşterimiz';
    const plate =
      details?.plate && details.plate !== 'Belirtilmedi'
        ? details.plate
        : app.vehicle?.plate || '';
    const phone = details?.phone || app.customer?.phone;
    const email = details?.email || app.customer?.email;
    const tenantTitle = details?.tenantTitle || 'WorksAuto Servis';

    const { dateFormatted, timeFormatted } =
      typeof this.templateService?.formatTurkeyDateTime === 'function'
        ? this.templateService.formatTurkeyDateTime(
            dto.slotDate,
            dto.slotStartTime,
          )
        : {
            dateFormatted: dto.slotDate,
            timeFormatted: dto.slotStartTime,
          };

    // Müşteriye WhatsApp ve SMS üzerinden gidecek nazik ve tam formatlı Türkçe mesaj
    const customerMessage =
      this.templateService.formatAppointmentRescheduledCustomerMessage({
        customerName,
        plate,
        dateFormatted,
        timeFormatted,
        reason: dto.reason,
        tenantTitle,
      });

    // Panel içi bildirim metni (kısa ve operasyonel)
    const internalNotificationMessage = `Randevu saati güncellendi: ${dateFormatted} (${timeFormatted}).${dto.reason ? ` Neden: ${dto.reason}` : ''}`;

    const requestedChannels =
      dto.channels && dto.channels.length > 0
        ? dto.channels
        : ['WHATSAPP', 'SMS', 'EMAIL'];

    const sendWhatsApp = !!(
      dto.notifyCustomer &&
      phone &&
      requestedChannels.includes('WHATSAPP')
    );
    const sendSms = !!(
      dto.notifyCustomer &&
      phone &&
      requestedChannels.includes('SMS')
    );
    const sendEmail = !!(
      dto.notifyCustomer &&
      email &&
      requestedChannels.includes('EMAIL')
    );

    let customerHtml: string | undefined;
    if (sendEmail) {
      customerHtml = this.templateService.generateBrandedHtmlEmail({
        title: 'Randevu Tarihiniz Güncellendi',
        customerName,
        message: `${plate ? `${plate} plakalı aracınıza ait ` : 'Aracınıza ait '}servis randevunuz yeni bir tarih ve saate güncellenmiştir.${dto.reason ? ` Erteleme Gerekçesi: ${dto.reason}` : ''}`,
        tenantTitle,
        extraDetails: {
          'Yeni Randevu Tarihi': dateFormatted,
          'Yeni Randevu Saati': timeFormatted,
          ...(plate ? { 'Araç Plakası': plate } : {}),
          ...(dto.reason ? { 'Erteleme Nedeni': dto.reason } : {}),
        },
      });
    }

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId: userId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      type: NotificationType.INFO,
      category: 'APPOINTMENT',
      title: 'Randevu Yeniden Planlandı',
      message: internalNotificationMessage,
      link: '/appointments',
      metadata: {
        appointmentId: id,
        reason: dto.reason,
        notifiedCustomer: !!(
          dto.notifyCustomer &&
          (sendWhatsApp || sendSms || sendEmail)
        ),
        channels: { sendWhatsApp, sendSms, sendEmail },
      },
      recipientPhone: phone || undefined,
      recipientEmail: email || undefined,
      customerMessage,
      customerHtml,
      sendSms,
      sendWhatsApp,
      sendEmail,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.rescheduled',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { slotDate: oldDate, slotStartTime: oldStart },
      changesAfter: {
        slotDate: dto.slotDate,
        slotStartTime: dto.slotStartTime,
        reason: dto.reason,
        notifiedCustomer: !!(dto.notifyCustomer && app.customer?.phone),
      },
    });

    return updated;
  }
}
