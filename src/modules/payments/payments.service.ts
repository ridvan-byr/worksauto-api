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

export interface CreatePaymentDto {
  invoiceId?: string;
  customerId?: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  method?: PaymentMethod;
  posSlipNo?: string;
  notes?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { customer: true, invoice: true },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async create(
    tenantId: string,
    dto: CreatePaymentDto,
    cashierName: string,
    actorUserId?: string,
  ) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException(
        'Tahsilat tutarı 0 dan büyük bir değer olmalıdır.',
      );
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
        },
      });

      // Update Invoice Remaining Amount if attached (tenantId scoped)
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, tenantId },
        });
        if (invoice) {
          const newPaid = Number(invoice.paidAmount) + dto.amount;
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
      },
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
    };
  }
}
