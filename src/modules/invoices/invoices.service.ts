import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { InvoiceStatus, CariReferenceType, NotificationType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateInvoiceDto {
  workOrderId?: string;
  customerId: string;
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(tenantId: string, status?: InvoiceStatus) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
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
  }

  async findOne(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        workOrder: { include: { items: true, vehicle: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('Fatura bulunamadı.');
    return inv;
  }

  async create(tenantId: string, dto: CreateInvoiceDto) {
    // Generate sequential invoice number (e.g. INV-2026-00042)
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const invNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          workOrderId: dto.workOrderId,
          customerId: dto.customerId,
          invoiceNumber: invNumber,
          issueDate: new Date(),
          dueDate: new Date(dto.dueDate),
          subtotal: dto.subtotal,
          kdvAmount: dto.kdvAmount,
          grandTotal: dto.grandTotal,
          remainingAmount: dto.grandTotal,
          status: InvoiceStatus.UNPAID,
          // v2.0 E-Invoice Port Hook
          gibInvoiceNumber: `GIB${new Date().getFullYear()}${String(count + 1).padStart(9, '0')}`,
          eInvoiceStatus: 'COMPLETED',
        },
      });

      // Update Current Account (Cari Hesap Borç Ekle)
      let currentAccount = await tx.currentAccount.findUnique({
        where: { customerId: dto.customerId },
      });

      if (!currentAccount) {
        currentAccount = await tx.currentAccount.create({
          data: {
            tenantId,
            customerId: dto.customerId,
          },
        });
      }

      if (currentAccount) {
        const newTotalDebits = Number(currentAccount.totalDebits) + dto.grandTotal;
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
            description: `Fatura Kesildi (#${invNumber})`,
            referenceType: CariReferenceType.INVOICE,
            referenceNo: invNumber,
            debit: dto.grandTotal,
            credit: 0,
            balanceAfter: newBalance,
          },
        });

        // CREDIT LIMIT CHECK (Şartname Madde 28): Limit aşılırsa işlem engellenmez, uyarı bildirimi üretilir
        const customer = await tx.customer.findUnique({
          where: { id: dto.customerId },
          select: { firstName: true, lastName: true, companyTitle: true, creditLimit: true },
        });

        if (customer && Number(customer.creditLimit) > 0 && newBalance > Number(customer.creditLimit)) {
          const custName = customer.companyTitle || `${customer.firstName} ${customer.lastName}`.trim();
          try {
            await this.notificationsService.createNotification({
              tenantId,
              targetRoles: ['OWNER', 'SERVICE_MANAGER', 'CASHIER'],
              category: 'FINANCE',
              type: NotificationType.WARNING,
              title: `Borç Limiti Aşıldı: ${custName}`,
              message: `${custName} için belirlenen ${Number(customer.creditLimit).toLocaleString('tr-TR')} ₺ borç limiti aşıldı! Güncel Bakiye: ${newBalance.toLocaleString('tr-TR')} ₺`,
              link: '/current-accounts',
              metadata: { customerId: dto.customerId, balance: newBalance, creditLimit: Number(customer.creditLimit) },
            });
          } catch (e) {
            // Notification error resilience
          }
        }
      }

      try {
        await this.auditService.log({
          tenantId,
          action: 'invoice.created',
          entityName: 'Invoice',
          entityId: invoice.id,
          changesAfter: {
            invoiceNumber: invNumber,
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

      return invoice;
    });
  }

  /**
   * CANCEL INVOICE (VUK 10 years compliance - NO HARD DELETE)
   */
  async cancelInvoice(tenantId: string, id: string, reason: string) {
    const inv = await this.findOne(tenantId, id);

    if (inv.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Ödemesi tamamlanmış bir fatura doğrudan iptal edilemez. Önce tahsilat iadesi yapılmalıdır.');
    }

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // Reverse Current Account Debit
      const currentAccount = await tx.currentAccount.findUnique({
        where: { customerId: inv.customerId },
      });

      if (currentAccount) {
        const newTotalDebits = Number(currentAccount.totalDebits) - Number(inv.grandTotal);
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
            description: `Fatura İptal Edildi (#${inv.invoiceNumber}) - Neden: ${reason}`,
            referenceType: CariReferenceType.INVOICE,
            referenceNo: inv.invoiceNumber,
            debit: 0,
            credit: inv.grandTotal, // Alacak kaydederek bakiyeyi düşür
            balanceAfter: newBalance,
          },
        });
      }

      try {
        await this.auditService.log({
          tenantId,
          action: 'invoice.cancelled',
          entityName: 'Invoice',
          entityId: inv.id,
          changesBefore: {
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            grandTotal: inv.grandTotal,
          },
          changesAfter: {
            status: InvoiceStatus.CANCELLED,
            reason,
          },
        });
      } catch (err) {
        console.error('Audit log failed for invoice.cancelled:', err);
      }

      return cancelled;
    });
  }
}
