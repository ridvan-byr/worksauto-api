import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { IInvoiceRepository, CreateInvoiceTransactionResult } from '../domain/invoice.repository.interface';
import { InvoiceEntity } from '../domain/invoice.entity';
import { InvoiceStatus, CariReferenceType, WorkOrderStatus } from '@prisma/client';

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
    const year = new Date().getFullYear();
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        tenantId_docType_year: {
          tenantId,
          docType: 'INVOICE',
          year,
        },
      },
      create: {
        tenantId,
        docType: 'INVOICE',
        year,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    const invoiceNumber = `INV-${year}-${String(sequence.lastNumber).padStart(5, '0')}`;
    const gibInvoiceNumber = `GIB${year}${String(sequence.lastNumber).padStart(9, '0')}`;
    return { invoiceNumber, gibInvoiceNumber };
  }

  async createWithCariMovement(invoice: InvoiceEntity): Promise<CreateInvoiceTransactionResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify customer strictly belongs to this tenant (IDOR Protection)
      const customer = await tx.customer.findFirst({
        where: { id: invoice.customerId, tenantId: invoice.tenantId, deletedAt: null },
        select: { firstName: true, lastName: true, companyTitle: true, creditLimit: true },
      });

      if (!customer) {
        throw new BadRequestException('Faturanın ait olduğu müşteri bulunamadı veya bu işletmeye ait değil.');
      }

      // 2. If workOrderId is provided, verify workOrder strictly belongs to this tenant and has no active invoice
      if (invoice.workOrderId) {
        const workOrder = await tx.workOrder.findFirst({
          where: { id: invoice.workOrderId, tenantId: invoice.tenantId },
        });

        if (!workOrder) {
          throw new BadRequestException('Faturanın ait olduğu iş emri bulunamadı veya bu işletmeye ait değil.');
        }

        const existingInvoiceForWO = await tx.invoice.findFirst({
          where: {
            workOrderId: invoice.workOrderId,
            tenantId: invoice.tenantId,
            status: { not: InvoiceStatus.CANCELLED },
          },
        });

        if (existingInvoiceForWO) {
          throw new BadRequestException(
            `Bu iş emrine ait aktif bir fatura (${existingInvoiceForWO.invoiceNumber}) zaten mevcuttur.`,
          );
        }
      }

      // 3. Update Current Account (Cari Hesap Borç Ekle) - Atomik Güncelleme
      let currentAccount = await tx.currentAccount.findFirst({
        where: { customerId: invoice.customerId, tenantId: invoice.tenantId },
      });

      if (!currentAccount) {
        currentAccount = await tx.currentAccount.create({
          data: {
            tenantId: invoice.tenantId,
            customerId: invoice.customerId,
          },
        });
      }

      if (currentAccount.isBlocked) {
        throw new BadRequestException('Bu müşterinin cari hesabı bloke durumdadır. Yeni fatura kesilemez.');
      }

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

      // 4. If linked to a work order, automatically mark work order as COMPLETED
      if (invoice.workOrderId) {
        await tx.workOrder.update({
          where: { id: invoice.workOrderId },
          data: {
            status: WorkOrderStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

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
      // 1. Verify invoice belongs strictly to this tenant (IDOR Protection)
      const existing = await tx.invoice.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new NotFoundException('Fatura bulunamadı veya bu işletmeye ait değil.');
      }

      if (existing.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Bu fatura zaten iptal edilmiştir.');
      }

      // Check if any payments are attached to this invoice
      const attachedPayments = await tx.payment.findMany({
        where: { invoiceId: existing.id, tenantId },
      });

      const cancelled = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          status: InvoiceStatus.CANCELLED,
          remainingAmount: 0,
          workOrderId: null,
        },
      });

      // 2. Query current account strictly scoped to tenantId and customerId
      const currentAccount = await tx.currentAccount.findFirst({
        where: { customerId: cancelled.customerId, tenantId },
      });

      if (currentAccount) {
        let totalCreditsAdjustment = 0;
        for (const p of attachedPayments) {
          totalCreditsAdjustment += Number(p.amount);
        }

        const newTotalDebits = Math.max(0, Number(currentAccount.totalDebits) - Number(cancelled.grandTotal));
        const newTotalCredits = Math.max(0, Number(currentAccount.totalCredits) - totalCreditsAdjustment);
        const newBalance = newTotalDebits - newTotalCredits;

        await tx.currentAccount.update({
          where: { id: currentAccount.id },
          data: {
            totalDebits: newTotalDebits,
            totalCredits: newTotalCredits,
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

        // If payments were registered for this invoice, reverse them from cari & remove payment records
        if (attachedPayments.length > 0) {
          for (const p of attachedPayments) {
            await tx.cariMovement.create({
              data: {
                tenantId,
                currentAccountId: currentAccount.id,
                date: new Date(),
                description: `Fatura İptali Nedeniyle Tahsilat İadesi (#${cancelled.invoiceNumber})`,
                referenceType: CariReferenceType.PAYMENT,
                referenceNo: p.id.substring(0, 8),
                debit: Number(p.amount),
                credit: 0,
                balanceAfter: newBalance,
              },
            });
          }

          await tx.payment.deleteMany({
            where: { invoiceId: existing.id, tenantId },
          });
        }
      }

      // 3. If linked to a work order, reopen work order back to IN_PROGRESS
      if (existing.workOrderId) {
        await tx.workOrder.update({
          where: { id: existing.workOrderId },
          data: {
            status: WorkOrderStatus.IN_PROGRESS,
            completedAt: null,
          },
        });
      }

      return this.mapToEntity(cancelled);
    });
  }
}

