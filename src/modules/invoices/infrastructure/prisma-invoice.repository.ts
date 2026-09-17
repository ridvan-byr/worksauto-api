import { calculateInvoiceTotals } from '../domain/invoice-totals';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  IInvoiceRepository,
  CreateInvoiceTransactionResult,
} from '../domain/invoice.repository.interface';
import { InvoiceEntity } from '../domain/invoice.entity';
import {
  InvoiceStatus,
  CariReferenceType,
  WorkOrderStatus,
  PaymentMethod,
} from '@prisma/client';

@Injectable()
export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): InvoiceEntity {
    const entity = new InvoiceEntity({
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
      profileId: data.profileId ?? undefined,
      invoiceTypeCode: data.invoiceTypeCode ?? 'SATIS',
      notes: data.notes ?? undefined,
      items: data.items,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      customer: data.customer,
      workOrder: data.workOrder,
      payments: data.payments,
    });
    (entity as any).totalAmount = entity.grandTotal;
    (entity as any).taxAmount = entity.kdvAmount;
    return entity;
  }

  async findById(tenantId: string, id: string): Promise<InvoiceEntity | null> {
    const data = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        workOrder: { include: { items: true, vehicle: true } },
        items: true,
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
        items: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: { issueDate: 'desc' },
    });
    return data.map((d) => this.mapToEntity(d));
  }

  async findByWorkOrderId(
    tenantId: string,
    workOrderId: string,
  ): Promise<InvoiceEntity | null> {
    const data = await this.prisma.invoice.findFirst({
      where: { tenantId, workOrderId },
    });
    return data ? this.mapToEntity(data) : null;
  }

  async getNextInvoiceNumber(
    tenantId: string,
  ): Promise<{ invoiceNumber: string; gibInvoiceNumber: string }> {
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

  async createWithCariMovement(
    invoice: InvoiceEntity,
    offsetAdvanceAmount?: number,
  ): Promise<CreateInvoiceTransactionResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.tenantId + ':' + invoice.customerId}))`;
      // 1. Verify customer strictly belongs to this tenant (IDOR Protection)
      const customer = await tx.customer.findFirst({
        where: {
          id: invoice.customerId,
          tenantId: invoice.tenantId,
          deletedAt: null,
        },
        select: {
          firstName: true,
          lastName: true,
          companyTitle: true,
          creditLimit: true,
          email: true,
          phone: true,
        },
      });

      if (!customer) {
        throw new BadRequestException(
          'Faturanın ait olduğu müşteri bulunamadı veya bu işletmeye ait değil.',
        );
      }

      // 2. If workOrderId is provided, verify workOrder strictly belongs to this tenant and has no active invoice
      let linkedWorkOrder: any = null;
      if (invoice.workOrderId) {
        const workOrder = await tx.workOrder.findFirst({
          where: { id: invoice.workOrderId, tenantId: invoice.tenantId },
          include: { items: true },
        });
        linkedWorkOrder = workOrder;

        if (!workOrder) {
          throw new BadRequestException(
            'Faturanın ait olduğu iş emri bulunamadı veya bu işletmeye ait değil.',
          );
        }

        if (workOrder.customerId !== invoice.customerId) {
          throw new BadRequestException(
            'İş emri ile faturanın müşterisi aynı olmalıdır.',
          );
        }

        if (workOrder.status === WorkOrderStatus.CANCELLED) {
          throw new BadRequestException(
            'İptal edilmiş bir iş emrine fatura kesilemez.',
          );
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

      let effectiveItems = invoice.items?.length
        ? invoice.items
        : linkedWorkOrder?.items;

      if (!effectiveItems?.length) {
        // Fallback: If work order had a grandTotal but no granular line items, generate standard service item
        const fallbackSubtotal =
          invoice.subtotal ||
          Math.round((Number(invoice.grandTotal || 0) / 1.2) * 100) / 100;
        effectiveItems = [
          {
            name: 'Genel Servis & Bakım Bedeli',
            quantity: 1,
            unitPrice: fallbackSubtotal,
            kdvRate: 20,
            totalPrice: fallbackSubtotal,
          },
        ];
      }

      let totals;
      try {
        totals = calculateInvoiceTotals(effectiveItems);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      for (const key of ['subtotal', 'kdvAmount', 'grandTotal'] as const) {
        if (!Number.isFinite(invoice[key])) {
          invoice[key] = totals[key];
          continue;
        }
        const diffCents = Math.abs(
          Math.round(invoice[key] * 100) - Math.round(totals[key] * 100),
        );
        // Allow up to 3 cents tolerance for tax rounding discrepancies between line-by-line and subtotal
        if (diffCents > 3) {
          throw new BadRequestException(
            'Fatura toplamları kalemler ile uyuşmuyor.',
          );
        }
        invoice[key] = totals[key];
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
        throw new BadRequestException(
          'Bu müşterinin cari hesabı bloke durumdadır. Yeni fatura kesilemez.',
        );
      }

      // Advance offset calculation (Cari avans mahsubu)
      let advancePaid = 0;
      const currentBalance = Number(currentAccount.balance);
      if (
        offsetAdvanceAmount &&
        offsetAdvanceAmount > 0 &&
        currentBalance < 0
      ) {
        const availableAdvance = Math.abs(currentBalance);
        advancePaid = Math.min(
          Number(invoice.grandTotal),
          Math.min(availableAdvance, Number(offsetAdvanceAmount)),
        );
      }

      const initialRemaining = Math.max(
        0,
        Number(invoice.grandTotal) - advancePaid,
      );
      const initialStatus =
        initialRemaining <= 0
          ? InvoiceStatus.PAID
          : advancePaid > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : (invoice.status as InvoiceStatus) || InvoiceStatus.UNPAID;

      // Allocate sequence number atomically inside transaction if not pre-assigned or PENDING
      let finalInvoiceNumber = invoice.invoiceNumber;
      let finalGibInvoiceNumber = invoice.gibInvoiceNumber;

      if (!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') {
        const year = new Date().getFullYear();
        const sequence = await tx.documentSequence.upsert({
          where: {
            tenantId_docType_year: {
              tenantId: invoice.tenantId,
              docType: 'INVOICE',
              year,
            },
          },
          create: {
            tenantId: invoice.tenantId,
            docType: 'INVOICE',
            year,
            lastNumber: 1,
          },
          update: {
            lastNumber: { increment: 1 },
          },
        });
        finalInvoiceNumber = `INV-${year}-${String(sequence.lastNumber).padStart(5, '0')}`;
        finalGibInvoiceNumber = `GIB${year}${String(sequence.lastNumber).padStart(9, '0')}`;
      }

      const created = await tx.invoice.create({
        data: {
          tenantId: invoice.tenantId,
          workOrderId: invoice.workOrderId,
          customerId: invoice.customerId,
          invoiceNumber: finalInvoiceNumber,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          subtotal: invoice.subtotal,
          kdvAmount: invoice.kdvAmount,
          grandTotal: invoice.grandTotal,
          paidAmount: advancePaid,
          remainingAmount: initialRemaining,
          status: initialStatus,
          gibInvoiceNumber: finalGibInvoiceNumber,
          eInvoiceStatus: invoice.eInvoiceStatus || 'COMPLETED',
          eInvoiceUuid: invoice.eInvoiceUuid,
          profileId: invoice.profileId,
          invoiceTypeCode: invoice.invoiceTypeCode || 'SATIS',
          notes: invoice.notes,
        },
      });

      // Snapshot items into InvoiceItem table for immutability and e-invoice integrity
      const itemsToSnapshot = effectiveItems;

      if (itemsToSnapshot.length > 0) {
        await tx.invoiceItem.createMany({
          data: itemsToSnapshot.map((item: any) => ({
            invoiceId: created.id,
            itemType: item.itemType || 'SERVICE',
            name: item.name || 'Hizmet / Kalem',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            kdvRate: Number(item.kdvRate ?? 20),
            totalPrice:
              (Math.round(Number(item.unitPrice) * 100) *
                Number(item.quantity)) /
              100,
            notes: item.notes || null,
          })),
        });
      }

      if (advancePaid > 0) {
        await tx.payment.create({
          data: {
            tenantId: invoice.tenantId,
            customerId: invoice.customerId,
            invoiceId: created.id,
            amount: advancePaid,
            paymentMethod: PaymentMethod.ADVANCE_OFFSET,
            paymentDate: new Date(),
            cashierName: 'Sistem (Cari Avans Mahsubu)',
            notes: `Fatura #${invoice.invoiceNumber} için müşteri cari avansından ${advancePaid.toLocaleString('tr-TR')} ₺ mahsup edildi.`,
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

      const advanceMovementNote =
        advancePaid > 0
          ? ` (${advancePaid.toLocaleString('tr-TR')} ₺ cari avansından mahsup edildi)`
          : '';

      await tx.cariMovement.create({
        data: {
          tenantId: invoice.tenantId,
          currentAccountId: currentAccount.id,
          date: new Date(),
          description: `Fatura Kesildi (#${finalInvoiceNumber})${advanceMovementNote}`,
          referenceType: CariReferenceType.INVOICE,
          referenceNo: finalInvoiceNumber,
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

      const tenant = await tx.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: { title: true },
      });

      const customerName =
        customer?.companyTitle ||
        `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
        'Müşteri';
      const creditLimit = customer?.creditLimit
        ? Number(customer.creditLimit)
        : 0;

      return {
        invoice: this.mapToEntity({
          ...created,
          items: await tx.invoiceItem.findMany({
            where: { invoiceId: created.id },
          }),
        }),
        newBalance,
        creditLimit,
        customerName,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        tenantTitle: tenant?.title || 'WorksAuto Servis',
      };
    });
  }

  async cancelWithCariReversal(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<InvoiceEntity> {
    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.invoice.findFirst({
        where: { id, tenantId },
        select: { customerId: true },
      });
      if (!owner) throw new NotFoundException('Fatura bulunamadı.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + owner.customerId}))`;
      // 1. Verify invoice belongs strictly to this tenant (IDOR Protection)
      const existing = await tx.invoice.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new NotFoundException(
          'Fatura bulunamadı veya bu işletmeye ait değil.',
        );
      }

      if (existing.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Bu fatura zaten iptal edilmiştir.');
      }

      // Check if any payments are attached to this invoice
      const attachedPayments = await tx.payment.findMany({
        where: { invoiceId: existing.id, tenantId },
      });

      const totalPaidAmount = attachedPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

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
        // Reverse only the invoice grand total from debits.
        // We do NOT decrement totalCredits or delete payments!
        // The customer paid that money, so it remains in totalCredits and creates/increases a credit balance (avans alacağı).
        const newTotalDebits = Math.max(
          0,
          Number(currentAccount.totalDebits) - Number(cancelled.grandTotal),
        );
        const newTotalCredits = Number(currentAccount.totalCredits);
        const newBalance = newTotalDebits - newTotalCredits;

        await tx.currentAccount.update({
          where: { id: currentAccount.id },
          data: {
            totalDebits: newTotalDebits,
            balance: newBalance,
          },
        });

        const advanceNote =
          totalPaidAmount > 0
            ? ` | Tahsil edilen ${totalPaidAmount.toLocaleString('tr-TR')} ₺ tutar müşteri cari hesabına avans olarak aktarıldı.`
            : '';

        await tx.cariMovement.create({
          data: {
            tenantId,
            currentAccountId: currentAccount.id,
            date: new Date(),
            description: `Fatura İptal Edildi (#${cancelled.invoiceNumber}) - Neden: ${reason}${advanceNote}`,
            referenceType: CariReferenceType.INVOICE,
            referenceNo: cancelled.invoiceNumber,
            debit: 0,
            credit: Number(cancelled.grandTotal),
            balanceAfter: newBalance,
          },
        });

        // Retain payments! Update notes to preserve audit trail instead of deleting payment records
        if (attachedPayments.length > 0) {
          for (const p of attachedPayments) {
            await tx.payment.update({
              where: { id: p.id },
              data: {
                notes: p.notes
                  ? `${p.notes} (Fatura #${cancelled.invoiceNumber} iptali nedeniyle avansa aktarıldı)`
                  : `Fatura #${cancelled.invoiceNumber} iptali nedeniyle müşteri avansına aktarıldı`,
              },
            });
          }
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

  async updateEInvoiceDetails(
    tenantId: string,
    id: string,
    data: {
      eInvoiceUuid?: string;
      gibInvoiceNumber?: string;
      eInvoiceStatus?: string;
      profileId?: string;
      notes?: string;
    },
  ): Promise<InvoiceEntity> {
    const updated = await this.prisma.invoice.update({
      where: { id, tenantId },
      data,
      include: {
        customer: true,
        workOrder: { include: { items: true, vehicle: true } },
        items: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    return this.mapToEntity(updated);
  }
}
