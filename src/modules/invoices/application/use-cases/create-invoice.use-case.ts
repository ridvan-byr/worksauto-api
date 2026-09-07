import { Injectable, Inject } from '@nestjs/common';
import { IInvoiceRepository, INVOICE_REPOSITORY } from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

export interface CreateInvoiceInput {
  workOrderId?: string;
  customerId: string;
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
}

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(tenantId: string, dto: CreateInvoiceInput, userId?: string): Promise<InvoiceEntity> {
    const { invoiceNumber, gibInvoiceNumber } = await this.invoiceRepository.getNextInvoiceNumber(tenantId);

    const entity = new InvoiceEntity({
      tenantId,
      workOrderId: dto.workOrderId,
      customerId: dto.customerId,
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(dto.dueDate),
      subtotal: dto.subtotal,
      kdvAmount: dto.kdvAmount,
      grandTotal: dto.grandTotal,
      remainingAmount: dto.grandTotal,
      status: 'UNPAID',
      gibInvoiceNumber,
      eInvoiceStatus: 'COMPLETED',
    });

    const result = await this.invoiceRepository.createWithCariMovement(entity);

    // CREDIT LIMIT CHECK (Şartname Madde 28)
    if (result.creditLimit > 0 && result.newBalance > result.creditLimit) {
      try {
        await this.notificationsService.createNotification({
          tenantId,
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
      } catch (e) {
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
          invoiceNumber,
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

    return result.invoice;
  }
}
