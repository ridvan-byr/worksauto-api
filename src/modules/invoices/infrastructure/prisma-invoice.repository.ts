import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { IInvoiceRepository, CreateInvoiceTransactionResult } from '../domain/invoice.repository.interface';
import { InvoiceEntity } from '../domain/invoice.entity';
import { InvoiceStatus, CariReferenceType } from '@prisma/client';

@Injectable()
export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): InvoiceEntity {
    return new InvoiceEntity({
      id: data.id,
      tenantId: data.tenantId,
      workOrderId: data.workOrderId ?? undefined,
      customerId: data.customerId,
      invoiceNumber: data.invoiceNumber,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      subtotal: Number(data.subtotal),
      kdvAmount: Number(data.kdvAmount),
      grandTotal: Number(data.grandTotal),
      paidAmount: Number(data.paidAmount ?? 0),
      remainingAmount: Number(data.remainingAmount ?? data.grandTotal),
      status: data.status,
      gibInvoiceNumber: data.gibInvoiceNumber ?? undefined,
      eInvoiceStatus: data.eInvoiceStatus ?? undefined,
      eInvoiceUuid: data.eInvoiceUuid ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      customer: data.customer,
      workOrder: data.workOrder,
      payments: data.payments,
    });
  }

  async findById(tenantId: string, id: string): Promise<InvoiceEntity | null> {
    const data = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        workOrder: { include: { items: true, vehicle: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    return data ? this.mapToEntity(data) : null;
  }

  async findAll(tenantId: string, status?: string): Promise<InvoiceEntity[]> {
    const data = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as InvoiceStatus } : {}),
      },
      include: {
        customer: true,
        workOrder: {
          include: {
            vehicle: true,
            items: true,
          },
        },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { issueDate: 'desc' },
    });
    return data.map((d) => this.mapToEntity(d));
  }

  async findByWorkOrderId(tenantId: string, workOrderId: string): Promise<InvoiceEntity | null> {
    const data = await this.prisma.invoice.findFirst({
      where: { tenantId, workOrderId },
    });
    return data ? this.mapToEntity(data) : null;
  }

  async getNextInvoiceNumber(tenantId: string): Promise<{ invoiceNumber: string; gibInvoiceNumber: string }> {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
    const gibInvoiceNumber = `GIB${year}${String(count + 1).padStart(9, '0')}`;
    return { invoiceNumber, gibInvoiceNumber };
  }

  async createWithCariMovement(invoice: InvoiceEntity): Promise<CreateInvoiceTransactionResult> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          tenantId: invoice.tenantId,
          workOrderId: invoice.workOrderId,
          customerId: invoice.customerId,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          subtotal: invoice.subtotal,
          kdvAmount: invoice.kdvAmount,
          grandTotal: invoice.grandTotal,
          remainingAmount: invoice.remainingAmount,
          status: invoice.status as InvoiceStatus,
          gibInvoiceNumber: invoice.gibInvoiceNumber,
          eInvoiceStatus: invoice.eInvoiceStatus || 'COMPLETED',
        },
      });

      // Update Current Account (Cari Hesap Borç Ekle) - Atomik Güncelleme
      let currentAccount = await tx.currentAccount.findUnique({
        where: { customerId: invoice.customerId },
      });

      if (!currentAccount) {
        currentAccount = await tx.currentAccount.create({
          data: {
            tenantId: invoice.tenantId,
            customerId: invoice.customerId,
          },
        });
      }

      // Atomically increment totalDebits and balance to avoid TOCTOU race condition
      const updatedCA = await tx.currentAccount.update({
        where: { id: currentAccount.id },
        data: {
          totalDebits: { increment: invoice.grandTotal },
          balance: { increment: invoice.grandTotal },
        },
      });

      const newBalance = Number(updatedCA.balance);

      await tx.cariMovement.create({
        data: {
          tenantId: invoice.tenantId,
          currentAccountId: currentAccount.id,
          date: new Date(),
          description: `Fatura Kesildi (#${invoice.invoiceNumber})`,
          referenceType: CariReferenceType.INVOICE,
          referenceNo: invoice.invoiceNumber,
          debit: invoice.grandTotal,
          credit: 0,
          balanceAfter: newBalance,
        },
      });

      const customer = await tx.customer.findUnique({
        where: { id: invoice.customerId },
        select: { firstName: true, lastName: true, companyTitle: true, creditLimit: true },
      });

      const customerName =
        customer?.companyTitle || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Müşteri';
      const creditLimit = customer?.creditLimit ? Number(customer.creditLimit) : 0;

      return {
        invoice: this.mapToEntity(created),
        newBalance,
        creditLimit,
        customerName,
      };
    });
  }

  async cancelWithCariReversal(tenantId: string, id: string, reason: string): Promise<InvoiceEntity> {
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      const currentAccount = await tx.currentAccount.findUnique({
        where: { customerId: cancelled.customerId },
      });

      if (currentAccount) {
        const newTotalDebits = Number(currentAccount.totalDebits) - Number(cancelled.grandTotal);
        const newBalance = newTotalDebits - Number(currentAccount.totalCredits);

        await tx.currentAccount.update({
          where: { id: currentAccount.id },
          data: {
            totalDebits: newTotalDebits,
            balance: newBalance,
          },
        });

        await tx.cariMovement.create({
          data: {
            tenantId,
            currentAccountId: currentAccount.id,
            date: new Date(),
            description: `Fatura İptal Edildi (#${cancelled.invoiceNumber}) - Neden: ${reason}`,
            referenceType: CariReferenceType.INVOICE,
            referenceNo: cancelled.invoiceNumber,
            debit: 0,
            credit: Number(cancelled.grandTotal),
            balanceAfter: newBalance,
          },
        });
      }

      return this.mapToEntity(cancelled);
    });
  }
}
