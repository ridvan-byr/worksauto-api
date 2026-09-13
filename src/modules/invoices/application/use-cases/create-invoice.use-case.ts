import { Injectable, Inject } from '@nestjs/common';
import {
  IInvoiceRepository,
  INVOICE_REPOSITORY,
} from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { NotificationTemplateService } from '../../../notifications/services/notification-template.service';

export interface CreateInvoiceInput {
  workOrderId?: string;
  customerId: string;
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
  offsetAdvanceAmount?: number;
  invoiceNumber?: string;
  gibInvoiceNumber?: string;
}

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateInvoiceInput,
    userId?: string,
  ): Promise<InvoiceEntity> {
    const entity = new InvoiceEntity({
      tenantId,
      workOrderId: dto.workOrderId,
      customerId: dto.customerId,
      invoiceNumber: dto.invoiceNumber || 'PENDING',
      issueDate: new Date(),
      dueDate: new Date(dto.dueDate),
      subtotal: dto.subtotal,
      kdvAmount: dto.kdvAmount,
      grandTotal: dto.grandTotal,
      remainingAmount: dto.grandTotal,
      status: 'UNPAID',
      gibInvoiceNumber: dto.gibInvoiceNumber || 'PENDING',
      eInvoiceStatus: 'COMPLETED',
    });

    const result = await this.invoiceRepository.createWithCariMovement(
      entity,
      dto.offsetAdvanceAmount,
    );

    // CREDIT LIMIT CHECK (Şartname Madde 28)
    if (result.creditLimit > 0 && result.newBalance > result.creditLimit) {
      try {
        await this.notificationsService.createNotification({
          tenantId,
          actorUserId: userId,
          targetRoles: ['OWNER', 'SERVICE_MANAGER', 'CASHIER'],
          category: 'FINANCE',
          type: NotificationType.WARNING,
          title: `Borç Limiti Aşıldı: ${result.customerName}`,
          message: `${result.customerName} için belirlenen ${result.creditLimit.toLocaleString('tr-TR')} ₺ borç limiti aşıldı! Güncel Bakiye: ${result.newBalance.toLocaleString('tr-TR')} ₺`,
          link: '/current-accounts',
          metadata: {
            customerId: dto.customerId,
            balance: result.newBalance,
            creditLimit: result.creditLimit,
          },
        });
      } catch {
        // Notification resilience
      }
    }

    try {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'invoice.created',
        entityName: 'Invoice',
        entityId: result.invoice.id,
        changesAfter: {
          invoiceNumber: result.invoice.invoiceNumber,
          grandTotal: dto.grandTotal,
          subtotal: dto.subtotal,
          kdvAmount: dto.kdvAmount,
          customerId: dto.customerId,
          workOrderId: dto.workOrderId,
        },
      });
    } catch (err) {
      console.error('Audit log failed for invoice.created:', err);
    }

    // Müşteriye Fatura & Online Ödeme Linki Bildirimi (E-Posta, SMS, WhatsApp)
    try {
      const customerName = result.customerName || 'Değerli Müşterimiz';
      const tenantTitle = result.tenantTitle || 'WorksAuto Servis';
      const paymentUrl = this.templateService.getPaymentUrl(result.invoice.id);

      const customerMsg = this.templateService.formatInvoiceCreatedCustomerMessage({
        customerName,
        invoiceNumber: result.invoice.invoiceNumber,
        grandTotal: dto.grandTotal,
        paymentUrl,
        tenantTitle,
      });

      const customerHtml = this.templateService.generateBrandedHtmlEmail({
        title: `Servis Faturanız Düzenlenmiştir (#${result.invoice.invoiceNumber})`,
        customerName,
        message: `${result.invoice.invoiceNumber} numaralı servis faturanız hazırlanmıştır. Fatura dökümünüzü inceleyebilir veya kredi kartınızla online güvenli ödeme yapabilirsiniz.`,
        buttonText: 'Faturayı İncele & Kredi Kartı ile Öde',
        buttonUrl: paymentUrl,
        tenantTitle,
        extraDetails: {
          'Fatura No': result.invoice.invoiceNumber,
          'Toplam Tutar': `${dto.grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
          'Vade Tarihi': dto.dueDate ? new Date(dto.dueDate).toLocaleDateString('tr-TR') : 'Peşin',
          'Durum': 'Ödeme Bekliyor',
        },
      });

      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.INFO,
        category: 'FINANCE',
        title: `Faturanız Düzenlendi (#${result.invoice.invoiceNumber})`,
        message: `${result.invoice.invoiceNumber} nolu servis faturanız düzenlenmiştir (Tutar: ${dto.grandTotal.toLocaleString('tr-TR')} ₺).`,
        link: `/invoices`,
        recipientPhone: result.customerPhone || undefined,
        recipientEmail: result.customerEmail || undefined,
        customerMessage: customerMsg,
        customerHtml,
        sendSms: !!result.customerPhone,
        sendWhatsApp: !!result.customerPhone,
        sendEmail: !!result.customerEmail,
      });
    } catch (notifErr) {
      console.warn('Invoice customer notification error:', notifErr);
    }

    return result.invoice;
  }
}
