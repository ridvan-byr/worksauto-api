import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { PaymentMethod, InvoiceStatus, CariReferenceType } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.payment.findMany({
      where: { tenantId },
      include: { customer: true, invoice: true },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreatePaymentDto, cashierName: string) {
    let customerId = dto.customerId;
    const paymentMethod = dto.paymentMethod || dto.method || PaymentMethod.CASH;

    if (!customerId && dto.invoiceId) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: dto.invoiceId },
        select: { customerId: true },
      });
      if (inv) customerId = inv.customerId;
    }

    if (!customerId) {
      throw new BadRequestException('Müşteri ID (customerId) belirtilmelidir.');
    }

    return this.prisma.$transaction(async (tx) => {
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

      // Update Invoice Remaining Amount if attached
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: dto.invoiceId } });
        if (invoice) {
          const newPaid = Number(invoice.paidAmount) + dto.amount;
          const newRemaining = Number(invoice.grandTotal) - newPaid;
          const newStatus = newRemaining <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

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

      // Update Current Account (Alacak Ekle)
      const currentAccount = await tx.currentAccount.findUnique({
        where: { customerId: dto.customerId },
      });

      if (currentAccount) {
        const newTotalCredits = Number(currentAccount.totalCredits) + dto.amount;
        const newBalance = Number(currentAccount.totalDebits) - newTotalCredits;

        await tx.currentAccount.update({
          where: { id: currentAccount.id },
          data: {
            totalCredits: newTotalCredits,
            balance: newBalance,
          },
        });

        await tx.cariMovement.create({
          data: {
            tenantId,
            currentAccountId: currentAccount.id,
            date: new Date(),
            description: `Tahsilat Alındı (${dto.paymentMethod})`,
            referenceType: CariReferenceType.PAYMENT,
            referenceNo: payment.id.substring(0, 8),
            debit: 0,
            credit: dto.amount,
            balanceAfter: newBalance,
          },
        });
      }

      return payment;
    });
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
      else if (p.paymentMethod === PaymentMethod.BANK_TRANSFER) totalTransfer += amt;
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
