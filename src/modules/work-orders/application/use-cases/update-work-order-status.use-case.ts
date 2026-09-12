import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import {
  WorkOrderStatusVO,
  WorkOrderStatusEnum,
} from '../../domain/value-objects/work-order-status.vo';
import { CreateInvoiceUseCase } from '../../../invoices/application/use-cases/create-invoice.use-case';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationTemplateService } from '../../../notifications/services/notification-template.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class UpdateWorkOrderStatusUseCase {
  private readonly templateService: NotificationTemplateService;

  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    @Optional()
    templateService?: NotificationTemplateService,
  ) {
    this.templateService = templateService || new NotificationTemplateService();
  }

  async execute(
    tenantId: string,
    id: string,
    newStatus: string,
    userId?: string,
  ) {
    const statusVO = new WorkOrderStatusVO(newStatus);
    const targetStatus = statusVO.getValue();

    const wo = await this.workOrderRepository.findById(tenantId, id);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    const currentStatusVO = new WorkOrderStatusVO(wo.status);
    if (!currentStatusVO.canTransitionTo(targetStatus)) {
      const statusLabels: Record<string, string> = {
        QUEUE: 'Kuyrukta (Sırada)',
        IN_PROGRESS: 'İşlemde (Onarımda)',
        COMPLETED: 'Tamamlandı',
        CANCELLED: 'İptal Edildi',
      };
      const fromLabel = statusLabels[wo.status] || wo.status;
      const toLabel = statusLabels[targetStatus] || targetStatus;
      throw new BadRequestException(
        `İş emri '${fromLabel}' durumundan doğrudan '${toLabel}' durumuna geçirilemez. Tamamlanmış veya iptal edilmiş iş emirleri için lütfen 'Geri Al' akışını kullanın.`,
      );
    }

    const completedAt =
      targetStatus === WorkOrderStatusEnum.COMPLETED ? new Date() : null;
    const updated = await this.workOrderRepository.updateStatus(
      tenantId,
      id,
      targetStatus,
      completedAt,
    );

    await this.auditService.log({
      tenantId,
      userId,
      action: 'work_order.status_changed',
      entityName: 'WorkOrder',
      entityId: id,
      changesBefore: {
        workOrderNumber: wo.workOrderNumber,
        status: wo.status,
        plate: wo.vehicle?.plate || 'Plaka Belirtilmedi',
        customerName:
          `${wo.customer?.firstName || ''} ${wo.customer?.lastName || ''}`.trim() ||
          'Müşteri Belirtilmedi',
      },
      changesAfter: {
        workOrderNumber: wo.workOrderNumber,
        status: targetStatus,
        plate: wo.vehicle?.plate || 'Plaka Belirtilmedi',
        customerName:
          `${wo.customer?.firstName || ''} ${wo.customer?.lastName || ''}`.trim() ||
          'Müşteri Belirtilmedi',
      },
    });

    // STOCK ROLLBACK RULE: If cancelled, restore stock
    if (
      targetStatus === WorkOrderStatusEnum.CANCELLED &&
      wo.status !== WorkOrderStatusEnum.CANCELLED
    ) {
      await this.workOrderRepository.restoreCancelledStock(
        tenantId,
        id,
        userId,
      );
    }

    // APPOINTMENT LIFECYCLE SYNC: If linked to an appointment, keep its status synchronized
    if (wo.appointmentId) {
      if (targetStatus === WorkOrderStatusEnum.COMPLETED) {
        await this.workOrderRepository.syncAppointmentStatus(
          tenantId,
          wo.appointmentId,
          'COMPLETED',
        );
      } else if (targetStatus === WorkOrderStatusEnum.IN_PROGRESS) {
        await this.workOrderRepository.syncAppointmentStatus(
          tenantId,
          wo.appointmentId,
          'IN_SERVICE',
        );
      }
    }

    // AUTO-INVOICE RULE: If completed, check autoInvoiceOnComplete
    if (targetStatus === WorkOrderStatusEnum.COMPLETED) {
      const isAutoInvoice =
        await this.workOrderRepository.getTenantAutoInvoiceConfig(tenantId);
      if (isAutoInvoice) {
        const existingInv =
          await this.workOrderRepository.findInvoiceByWorkOrder(tenantId, id);
        if (!existingInv && Number(wo.grandTotal) > 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);

          const invoice = await this.createInvoiceUseCase.execute(
            tenantId,
            {
              workOrderId: id,
              customerId: wo.customerId,
              dueDate: dueDate.toISOString().split('T')[0],
              subtotal: Number(wo.subtotal),
              kdvAmount: Number(wo.kdvAmount),
              grandTotal: Number(wo.grandTotal),
            },
            userId,
          );

          await this.auditService.log({
            tenantId,
            userId,
            action: 'invoice.auto_created_on_wo_complete',
            entityName: 'Invoice',
            entityId: invoice.id,
            changesAfter: {
              workOrderId: id,
              invoiceNumber: invoice.invoiceNumber,
              grandTotal: invoice.grandTotal,
            },
          });
        }
      }
    }

    // WebSockets & Notifications
    this.eventsGateway.emitToTenant(tenantId, 'work_order:status_changed', {
      workOrderId: id,
      status: targetStatus,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
    });

    const tenantTitle = (wo as any).tenant?.title || 'Oto Servisiniz';
    const customerName = wo.customer
      ? `${wo.customer.firstName} ${wo.customer.lastName || ''}`.trim()
      : 'Değerli Müşterimiz';
    const plate = wo.vehicle?.plate || '';
    const trackingUrl = this.templateService.getTrackingUrl(id);
    const statusLabelTr =
      this.templateService.getWorkOrderStatusLabel(targetStatus);

    if (targetStatus === WorkOrderStatusEnum.COMPLETED) {
      this.eventsGateway.emitToTenant(tenantId, 'work_order:completed', {
        workOrderId: id,
        workOrderNumber: wo.workOrderNumber,
        plate: wo.vehicle?.plate,
      });

      const customerMsg =
        this.templateService.formatWorkOrderCompletedCustomerMessage({
          customerName,
          plate,
          workOrderNumber: wo.workOrderNumber,
          trackingUrl,
          tenantTitle,
        });

      const customerHtml = this.templateService.generateBrandedHtmlEmail({
        title: 'Servis Onarım İşleminiz Tamamlandı',
        customerName,
        message: `${wo.workOrderNumber} numaralı iş emrine ait ${plate ? plate + ' plakalı ' : ''}aracınızın tüm bakım ve onarım işlemleri başarıyla tamamlanmış ve teslime hazır hale getirilmiştir.`,
        buttonText: 'Canlı Takip ve İşlem Detayı',
        buttonUrl: trackingUrl,
        tenantTitle,
        extraDetails: {
          'İş Emri No': wo.workOrderNumber,
          Plaka: plate || 'Belirtilmedi',
          Durum: 'Tamamlandı / Teslime Hazır',
        },
      });

      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.SUCCESS,
        category: 'WORK_ORDER',
        title: 'İş Emri Tamamlandı',
        message: `${wo.workOrderNumber} nolu iş emri (${plate || ''}) başarıyla tamamlandı.`,
        link: `/work-orders/${id}`,
        metadata: {
          workOrderId: id,
          workOrderNumber: wo.workOrderNumber,
          trackingUrl,
        },
        recipientPhone: wo.customer?.phone,
        recipientEmail: (wo.customer as any)?.email,
        customerMessage: customerMsg,
        customerHtml,
        sendSms: !!wo.customer?.phone,
        sendWhatsApp: !!wo.customer?.phone,
        sendEmail: !!(wo.customer as any)?.email,
      });
    } else {
      const customerMsg =
        this.templateService.formatWorkOrderStatusChangedCustomerMessage({
          customerName,
          plate,
          workOrderNumber: wo.workOrderNumber,
          status: targetStatus,
          trackingUrl,
          tenantTitle,
        });

      const customerHtml = this.templateService.generateBrandedHtmlEmail({
        title: `İş Emri Durum Güncellemesi: ${statusLabelTr}`,
        customerName,
        message: `${wo.workOrderNumber} numaralı iş emrine ait ${plate ? plate + ' plakalı ' : ''}aracınızın işlem aşaması "${statusLabelTr}" olarak güncellenmiştir.`,
        buttonText: 'Canlı Takip Sayfasını Aç',
        buttonUrl: trackingUrl,
        tenantTitle,
        extraDetails: {
          'İş Emri No': wo.workOrderNumber,
          Plaka: plate || 'Belirtilmedi',
          'Yeni Aşama': statusLabelTr,
        },
      });

      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.INFO,
        category: 'WORK_ORDER',
        title: 'İş Emri Durumu Değişti',
        message: `${wo.workOrderNumber} (${plate || ''}) aşaması "${statusLabelTr}" olarak güncellendi.`,
        link: `/work-orders/${id}`,
        metadata: {
          workOrderId: id,
          workOrderNumber: wo.workOrderNumber,
          status: targetStatus,
          statusLabelTr,
          trackingUrl,
        },
        recipientPhone: wo.customer?.phone,
        recipientEmail: (wo.customer as any)?.email,
        customerMessage: customerMsg,
        customerHtml,
        sendSms:
          targetStatus === WorkOrderStatusEnum.IN_PROGRESS &&
          !!wo.customer?.phone,
        sendWhatsApp: !!wo.customer?.phone,
        sendEmail: !!(wo.customer as any)?.email,
      });
    }

    return updated;
  }
}
