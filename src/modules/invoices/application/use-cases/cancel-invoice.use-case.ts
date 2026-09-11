import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IInvoiceRepository,
  INVOICE_REPOSITORY,
} from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';

@Injectable()
export class CancelInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    reason: string,
    userId?: string,
  ): Promise<InvoiceEntity> {
    const inv = await this.invoiceRepository.findById(tenantId, id);
    if (!inv) {
      throw new NotFoundException('Fatura bulunamadı.');
    }

    if (!inv.canCancel()) {
      throw new BadRequestException(
        'Ödemesi tamamlanmış veya tahsilat yapılmış bir fatura doğrudan iptal edilemez. Önce tahsilat iadesi yapılmalıdır.',
      );
    }

    const cancelled = await this.invoiceRepository.cancelWithCariReversal(
      tenantId,
      id,
      reason,
    );

    try {
      await this.auditService.log({
        tenantId,
        userId,
        action: 'invoice.cancelled',
        entityName: 'Invoice',
        entityId: inv.id,
        changesBefore: {
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          grandTotal: inv.grandTotal,
        },
        changesAfter: {
          status: 'CANCELLED',
          reason,
        },
      });
    } catch (err) {
      console.error('Audit log failed for invoice.cancelled:', err);
    }

    return cancelled;
  }
}
