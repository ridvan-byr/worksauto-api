import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationTemplateService } from '../../../notifications/services/notification-template.service';
import { AuditService } from '../../../audit/audit.service';
import { NotificationType } from '@prisma/client';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';
import { NotifyWorkOrderStatusDto } from '../../dto/notify-status.dto';

@Injectable()
export class NotifyWorkOrderStatusUseCase {
  private readonly templateService: NotificationTemplateService;

  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    templateService?: NotificationTemplateService,
  ) {
    this.templateService = templateService || new NotificationTemplateService();
  }

  async execute(
    tenantId: string,
    workOrderId: string,
    dto: NotifyWorkOrderStatusDto,
    userId?: string,
  ) {
    const wo = await this.workOrderRepository.findById(tenantId, workOrderId);
    if (!wo) {
      throw new NotFoundException('İş emri bulunamadı.');
    }

    if (!wo.customer) {
      throw new BadRequestException('İş emrine atanmış bir müşteri bulunamadı.');
    }

    const currentStatus = wo.status as WorkOrderStatusEnum;
    const statusLabelTr =
      this.templateService.getWorkOrderStatusLabel(currentStatus);
    const tenantTitle = (wo as any).tenant?.title || 'Oto Servisiniz';
    const customerName =
      `${wo.customer.firstName} ${wo.customer.lastName || ''}`.trim() ||
      'Değerli Müşterimiz';
    const plate = wo.vehicle?.plate || '';
    const trackingUrl = this.templateService.getTrackingUrl(workOrderId);

    // Format customer text & HTML email
    let customerMsg = '';
    let emailTitle = '';
    let emailMessage = '';

    if (currentStatus === WorkOrderStatusEnum.COMPLETED) {
      customerMsg =
        this.templateService.formatWorkOrderCompletedCustomerMessage({
          customerName,
          plate,
          workOrderNumber: wo.workOrderNumber,
          trackingUrl,
          tenantTitle,
        });
      emailTitle = 'Servis Onarım İşleminiz Tamamlandı';
      emailMessage = `${wo.workOrderNumber} numaralı iş emrine ait ${plate ? plate + ' plakalı ' : ''}aracınızın tüm bakım ve onarım işlemleri başarıyla tamamlanmış ve teslime hazır hale getirilmiştir.`;
    } else if (currentStatus === WorkOrderStatusEnum.CANCELLED) {
      customerMsg =
        this.templateService.formatWorkOrderCancelledCustomerMessage({
          customerName,
          plate,
          workOrderNumber: wo.workOrderNumber,
          trackingUrl,
          tenantTitle,
        });
      emailTitle = `İş Emriniz İptal Edilmiştir (#${wo.workOrderNumber})`;
      emailMessage = `${wo.workOrderNumber} numaralı iş emrine ait ${plate ? plate + ' plakalı ' : ''}aracınızın servis kaydı iptal edilmiştir.`;
    } else {
      customerMsg =
        this.templateService.formatWorkOrderStatusChangedCustomerMessage({
          customerName,
          plate,
          workOrderNumber: wo.workOrderNumber,
          status: currentStatus,
          trackingUrl,
          tenantTitle,
        });
      emailTitle = `İş Emri Durum Güncellemesi: ${statusLabelTr}`;
      emailMessage = `${wo.workOrderNumber} numaralı iş emrine ait ${plate ? plate + ' plakalı ' : ''}aracınızın işlem aşaması "${statusLabelTr}" olarak güncellenmiştir.`;
    }

    // Append custom message note if advisor provided one
    if (dto.customMessage && dto.customMessage.trim()) {
      customerMsg += `\n\n📌 Servis Danışmanı Notu: ${dto.customMessage.trim()}`;
      emailMessage += `<br><br><strong>Servis Danışmanı Notu:</strong> ${dto.customMessage.trim()}`;
    }

    const customerHtml = this.templateService.generateBrandedHtmlEmail({
      title: emailTitle,
      customerName,
      message: emailMessage,
      buttonText: 'Canlı Takip Sayfasını Aç',
      buttonUrl: trackingUrl,
      tenantTitle,
      extraDetails: {
        'İş Emri No': wo.workOrderNumber,
        Plaka: plate || 'Belirtilmedi',
        Durum: statusLabelTr,
        Tarih: new Date().toLocaleDateString('tr-TR'),
      },
    });

    // Determine channels
    const requestedChannels =
      dto.channels && dto.channels.length > 0
        ? dto.channels
        : ['EMAIL', 'WHATSAPP', 'SMS'];
    const sendEmail =
      requestedChannels.includes('EMAIL') && !!(wo.customer as any)?.email;
    const sendWhatsApp =
      requestedChannels.includes('WHATSAPP') && !!wo.customer?.phone;
    const sendSms = requestedChannels.includes('SMS') && !!wo.customer?.phone;

    if (!sendEmail && !sendWhatsApp && !sendSms) {
      throw new BadRequestException(
        'Müşterinin seçilen kanallar için iletişim bilgisi (telefon veya e-posta) bulunmuyor.',
      );
    }

    const notification = await this.notificationsService.createNotification({
      tenantId,
      actorUserId: userId,
      type:
        currentStatus === WorkOrderStatusEnum.COMPLETED
          ? NotificationType.SUCCESS
          : NotificationType.INFO,
      category: 'WORK_ORDER',
      title: `İş Emri Durumu: ${statusLabelTr}`,
      message: `${wo.workOrderNumber} (${plate || ''}) durumu "${statusLabelTr}" bildirimi gönderildi.`,
      link: `/work-orders/${workOrderId}`,
      metadata: {
        workOrderId,
        workOrderNumber: wo.workOrderNumber,
        status: currentStatus,
        statusLabelTr,
        trackingUrl,
        sentChannels: {
          email: sendEmail,
          whatsapp: sendWhatsApp,
          sms: sendSms,
        },
      },
      recipientPhone: wo.customer?.phone,
      recipientEmail: (wo.customer as any)?.email,
      customerMessage: customerMsg,
      customerHtml,
      sendSms,
      sendWhatsApp,
      sendEmail,
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'WORK_ORDER_STATUS_NOTIFIED',
      entityName: 'WORK_ORDER',
      entityId: workOrderId,
      changesAfter: {
        status: currentStatus,
        channels: { sendEmail, sendWhatsApp, sendSms },
        customMessage: dto.customMessage,
      },
    });

    return {
      success: true,
      notificationId: notification.id,
      channels: {
        email: sendEmail,
        whatsapp: sendWhatsApp,
        sms: sendSms,
      },
    };
  }
}
