import { randomUUID } from 'crypto';
import { CreatePaymentDto } from './dto/create-payment.dto';
export { CreatePaymentDto } from './dto/create-payment.dto';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import {
  PaymentMethod,
  InvoiceStatus,
  CariReferenceType,
  NotificationType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queues/queue.service';

import {
  PayTrService,
  PayTrWebhookPayload,
} from './infrastructure/paytr.service';

import { NotificationTemplateService } from '../notifications/services/notification-template.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
    private readonly payTrService: PayTrService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  async findAll(tenantId: string, page?: number, limit?: number) {
    const isExplicitPagination = page !== undefined || limit !== undefined;
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { tenantId },
        include: { customer: true, invoice: true },
        orderBy: { paymentDate: 'desc' },
        take: safeLimit,
        skip: isExplicitPagination ? skip : 0,
      }),
      this.prisma.payment.count({ where: { tenantId } }),
    ]);

    if (isExplicitPagination) {
      return {
        data: items,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    }

    return items;
  }

  async create(
    tenantId: string,
    dto: CreatePaymentDto,
    cashierName: string,
    actorUserId?: string,
    gatewayAttemptId?: string,
  ) {
    if (
      !Number.isFinite(dto.amount) ||
      dto.amount <= 0 ||
      Math.abs(dto.amount * 100 - Math.round(dto.amount * 100)) > 0.000001
    ) {
      throw new BadRequestException(
        'Tahsilat tutarı 0 dan büyük bir değer olmalıdır.',
      );
    }

    if (gatewayAttemptId) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          tenantId,
          gatewayProvider: 'PAYTR',
          transactionId: gatewayAttemptId,
        },
      });
      if (existing) return existing;
    }
    let customerId = dto.customerId;
    const paymentMethod = dto.paymentMethod || dto.method || PaymentMethod.CASH;

    if (dto.invoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId },
        select: {
          customerId: true,
          status: true,
          remainingAmount: true,
          paidAmount: true,
        },
      });
      if (!inv) {
        throw new BadRequestException(
          'Belirtilen fatura bulunamadı veya bu işletmeye ait değil.',
        );
      }
      if (inv.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException(
          'İptal edilmiş bir faturaya tahsilat eklenemez.',
        );
      }
      if (
        inv.status === InvoiceStatus.PAID ||
        Number(inv.remainingAmount) <= 0
      ) {
        throw new BadRequestException(
          'Bu faturanın ödemesi zaten tamamlanmıştır.',
        );
      }
      if (dto.amount > Number(inv.remainingAmount)) {
        throw new BadRequestException(
          `Tahsilat tutarı (${dto.amount.toLocaleString('tr-TR')} ₺), faturanın kalan açık bakiyesinden (${Number(inv.remainingAmount).toLocaleString('tr-TR')} ₺) fazla olamaz.`,
        );
      }
      if (!customerId) {
        customerId = inv.customerId;
      } else if (customerId !== inv.customerId) {
        throw new BadRequestException(
          'Faturanın ait olduğu müşteri ile ödeme yapılan müşteri uyuşmuyor.',
        );
      }
    }

    if (!customerId) {
      throw new BadRequestException('Müşteri ID (customerId) belirtilmelidir.');
    }

    // Faturasız Serbest Avans / Cari Tahsilat Denetimi
    if (!dto.invoiceId) {
      const reference = (dto.posSlipNo || dto.notes || '').trim();
      if (reference.length < 3) {
        throw new BadRequestException(
          'Faturasız serbest cari/avans tahsilatlarında dekont/fiş no veya açıklama (en az 3 karakter) girilmesi zorunludur.',
        );
      }
    }

    // Verify customer strictly belongs to this tenant
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) {
      throw new BadRequestException(
        'Belirtilen müşteri bulunamadı veya bu işletmeye ait değil.',
      );
    }

    const createdPayment = await this.prisma.$transaction(async (tx) => {
      // All monetary writes for a customer share this transaction lock.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + customerId}))`;
      if (gatewayAttemptId) {
        const existing = await tx.payment.findFirst({
          where: {
            tenantId,
            gatewayProvider: 'PAYTR',
            transactionId: gatewayAttemptId,
          },
        });
        if (existing) return existing;
      }
      if (dto.invoiceId) {
        const current = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, tenantId },
        });
        if (
          !current ||
          current.status === InvoiceStatus.CANCELLED ||
          dto.amount > Number(current.remainingAmount)
        ) {
          throw new BadRequestException(
            'Fatura bakiyesi değişti. Lütfen güncel bakiyeyi kontrol ediniz.',
          );
        }
      }
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          customerId,
          amount: dto.amount,
          paymentMethod,
          cashierName,
          posSlipNo: dto.posSlipNo,
          notes: dto.notes,
          ...(gatewayAttemptId
            ? { gatewayProvider: 'PAYTR', transactionId: gatewayAttemptId }
            : {}),
        },
      });

      // Update Invoice Remaining Amount if attached (tenantId scoped)
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, tenantId },
        });
        if (invoice) {
          const newPaid =
            Math.round((Number(invoice.paidAmount) + dto.amount) * 100) / 100;
          const newRemaining = Number(invoice.grandTotal) - newPaid;
          const newStatus =
            newRemaining <= 0
              ? InvoiceStatus.PAID
              : InvoiceStatus.PARTIALLY_PAID;

          await tx.invoice.update({
            where: { id: dto.invoiceId },
            data: {
              paidAmount: newPaid,
              remainingAmount: Math.max(0, newRemaining),
              status: newStatus,
            },
          });
        }
      }

      // Update Current Account (Alacak Ekle - Atomik Güncelleme, tenantId scoped)
      let currentAccount = await tx.currentAccount.findFirst({
        where: { customerId, tenantId },
      });

      if (!currentAccount) {
        currentAccount = await tx.currentAccount.create({
          data: {
            tenantId,
            customerId,
          },
        });
      }

      // Atomically increment totalCredits and decrement balance to prevent TOCTOU
      const updatedCA = await tx.currentAccount.update({
        where: { id: currentAccount.id },
        data: {
          totalCredits: { increment: dto.amount },
          balance: { decrement: dto.amount },
        },
      });

      const newBalance = Number(updatedCA.balance);

      await tx.cariMovement.create({
        data: {
          tenantId,
          currentAccountId: currentAccount.id,
          date: new Date(),
          description: `Tahsilat Alındı (${paymentMethod})`,
          referenceType: CariReferenceType.PAYMENT,
          referenceNo: payment.id.substring(0, 8),
          debit: 0,
          credit: dto.amount,
          balanceAfter: newBalance,
        },
      });

      try {
        await this.auditService.log({
          tenantId,
          action: 'payment.created',
          entityName: 'Payment',
          entityId: payment.id,
          changesAfter: {
            amount: dto.amount,
            paymentMethod,
            cashierName,
            posSlipNo: dto.posSlipNo,
            notes: dto.notes,
            invoiceId: dto.invoiceId,
            customerId,
          },
        });
      } catch (err) {
        console.error('Audit log failed for payment.created:', err);
      }

      if (gatewayAttemptId)
        await tx.paymentAttempt.update({
          where: { id: gatewayAttemptId },
          data: { status: 'PAID' },
        });
      return payment;
    });

    // Real-time WebSocket emission & in-app notification
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : 'Müşteri';

    this.eventsGateway.emitToTenant(tenantId, 'payment:received', {
      ...createdPayment,
      customerName,
    });

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'CASHIER'],
      type: NotificationType.SUCCESS,
      category: 'FINANCE',
      title: 'Yeni Tahsilat Alındı',
      message: `${Number(dto.amount).toLocaleString('tr-TR')} ₺ tahsilat kaydedildi (${paymentMethod}). Müşteri: ${customerName}`,
      link: '/billing/payments',
      metadata: {
        paymentId: createdPayment.id,
        amount: dto.amount,
        method: paymentMethod,
      },
    });

    // Müşteriye Ödeme Alındı & Tahsilat Makbuzu Bildirimi (E-Posta, SMS, WhatsApp)
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { title: true },
      });
      const tenantTitle = tenant?.title || 'WorksAuto Servis';

      let invoiceNumber: string | undefined;
      if (dto.invoiceId) {
        const inv = await this.prisma.invoice.findUnique({
          where: { id: dto.invoiceId },
          select: { invoiceNumber: true },
        });
        invoiceNumber = inv?.invoiceNumber;
      }

      const customerMsg =
        this.templateService.formatPaymentReceivedCustomerMessage({
          customerName,
          amount: dto.amount,
          invoiceNumber,
          tenantTitle,
        });

      const customerHtml = this.templateService.generateBrandedHtmlEmail({
        title: 'Ödemeniz Başarıyla Alınmıştır',
        customerName,
        message: `${Number(dto.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ tutarındaki servis ödemeniz başarıyla tahsil edilmiş ve kayıtlara işlenmiştir. Bizi tercih ettiğiniz için teşekkür ederiz.`,
        tenantTitle,
        extraDetails: {
          'Tahsilat Tutarı': `${Number(dto.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`,
          'Ödeme Yöntemi': paymentMethod,
          ...(invoiceNumber ? { 'Fatura No': invoiceNumber } : {}),
          'İşlem Tarihi': new Date().toLocaleDateString('tr-TR'),
          Durum: 'Tahsil Edildi (Başarılı)',
        },
      });

      await this.notificationsService.createNotification({
        tenantId,
        actorUserId,
        type: NotificationType.SUCCESS,
        category: 'FINANCE',
        title: 'Ödemeniz Alındı (Makbuz)',
        message: `${Number(dto.amount).toLocaleString('tr-TR')} ₺ tutarındaki ödemeniz başarıyla kaydedildi.`,
        recipientPhone: customer.phone || undefined,
        recipientEmail: customer.email || undefined,
        customerMessage: customerMsg,
        customerHtml,
        sendSms: !!customer.phone,
        sendWhatsApp: !!customer.phone,
        sendEmail: !!customer.email,
      });
    } catch (custNotifErr) {
      console.warn('Customer payment notification error:', custNotifErr);
    }

    return createdPayment;
  }

  /**
   * DAILY CASHIER REPORT
   */
  async getDailySummary(tenantId: string, dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: { gte: startOfDay, lte: endOfDay },
        paymentMethod: { not: PaymentMethod.ADVANCE_OFFSET },
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyTitle: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    let totalCash = 0;
    let totalPos = 0;
    let totalTransfer = 0;
    let totalOnline = 0;

    for (const p of payments) {
      const amt = Number(p.amount);
      if (p.paymentMethod === PaymentMethod.CASH) totalCash += amt;
      else if (p.paymentMethod === PaymentMethod.POS) totalPos += amt;
      else if (p.paymentMethod === PaymentMethod.BANK_TRANSFER)
        totalTransfer += amt;
      else if (p.paymentMethod === PaymentMethod.ONLINE) totalOnline += amt;
    }

    const grandTotal = totalCash + totalPos + totalTransfer + totalOnline;

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalCash,
      totalPos,
      totalTransfer,
      totalOnline,
      grandTotal,
      transactionCount: payments.length,
      payments: payments.map((p) => {
        const customerName = p.customer
          ? `${p.customer.firstName || ''} ${p.customer.lastName || ''}`.trim() ||
            p.customer.companyTitle ||
            'Müşteri'
          : 'Müşteri';
        return {
          id: p.id,
          customerName,
          invoiceNumber: p.invoice?.invoiceNumber || '-',
          method: p.paymentMethod,
          amount: Number(p.amount),
          date: p.paymentDate.toISOString(),
          posSlipNo: p.posSlipNo,
          notes: p.notes,
          cashierName: p.cashierName,
        };
      }),
    };
  }

  /**
   * Generates a PayTR iframe checkout token for a specific invoice (public/unauthenticated)
   */
  async createPayTrPaymentToken(invoiceId: string, clientIp: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        customer: true,
        workOrder: {
          include: {
            vehicle: true,
            items: true,
          },
        },
        tenant: true,
      },
    });

    if (!invoice) {
      throw new BadRequestException('Fatura bulunamadı.');
    }

    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException('Bu fatura zaten tamamen ödenmiştir.');
    }

    const remainingAmount =
      Number(invoice.grandTotal) - Number(invoice.paidAmount || 0);
    if (remainingAmount <= 0) {
      throw new BadRequestException('Ödenecek kalan bakiye bulunmuyor.');
    }

    if (
      !invoice.customer?.email ||
      !invoice.customer?.phone ||
      !invoice.customer?.address
    ) {
      throw new BadRequestException(
        'Online ödeme için müşteri e-posta, telefon ve adres bilgileri gereklidir.',
      );
    }
    const basketItems = [
      {
        name: `Fatura kalan bakiyesi (${invoice.invoiceNumber})`,
        price: remainingAmount.toFixed(2),
        quantity: 1,
      },
    ];

    const customerName = invoice.customer
      ? `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim() ||
        'Değerli Müşterimiz'
      : 'Değerli Müşterimiz';

    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        id: randomUUID().replace(/-/g, ''),
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        amount: remainingAmount,
      },
    });
    const returnUrl = `${process.env.APP_BASE_URL || process.env.WEB_URL || 'http://localhost:3000'}/pay/${invoice.id}`;
    const paytrRes = await this.payTrService.createIframeToken({
      merchantOid: attempt.id,
      userAddress: invoice.customer?.address || undefined,
      merchantOkUrl: returnUrl,
      merchantFailUrl: returnUrl,
      email: invoice.customer.email,
      paymentAmount: remainingAmount,
      userName: customerName,
      userPhone: invoice.customer.phone,
      userIp: clientIp || '127.0.0.1',
      basket: basketItems,
    });

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName,
      plate: invoice.workOrder?.vehicle?.plate || 'Plaka',
      remainingAmount,
      totalAmount: Number(invoice.grandTotal),
      paytrToken: paytrRes.token,
      iframeUrl: paytrRes.iframeUrl,
      isTest: paytrRes.isTest,
    };
  }

  /**
   * Processes PayTR Webhook notification
   */
  async handlePayTrWebhook(payload: PayTrWebhookPayload): Promise<string> {
    const isValid = this.payTrService.verifyWebhook(payload);
    if (!isValid) {
      throw new BadRequestException('PAYTR_SIGNATURE_INVALID');
    }

    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: payload.merchant_oid },
    });
    if (!attempt) throw new BadRequestException('Unknown payment attempt.');
    if (attempt.status === 'PAID') return 'OK';
    const invoiceId = attempt.invoiceId;
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId },
    });

    if (!invoice)
      throw new BadRequestException('Payment invoice was not found.');
    // A second successful attempt needs reconciliation; never acknowledge it as recorded.
    if (payload.status === 'success' && invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('PAYMENT_RECONCILIATION_REQUIRED');
    }

    if (payload.status === 'success') {
      const paidTl = Number(payload.total_amount) / 100;
      if (paidTl !== Number(attempt.amount))
        throw new BadRequestException('PAYMENT_AMOUNT_MISMATCH');
      await this.create(
        invoice.tenantId,
        {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount: paidTl,
          paymentMethod: PaymentMethod.ONLINE,
          notes: `PayTR Online 3D-Secure Tahsilat (Sipariş: ${payload.merchant_oid})`,
        },
        'PayTR Sanal POS',
        undefined,
        attempt.id,
      );
    }

    return 'OK';
  }
}
