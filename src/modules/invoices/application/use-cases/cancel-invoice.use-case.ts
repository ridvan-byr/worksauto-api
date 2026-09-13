import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IInvoiceRepository,
  INVOICE_REPOSITORY,
} from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';
import { EInvoiceProviderFactory } from '../../infrastructure/providers/einvoice-provider.factory';

@Injectable()
export class CancelInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly auditService: AuditService,
    @Optional()
    private readonly providerFactory?: EInvoiceProviderFactory,
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

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException(
        'Fatura iptal gerekçesi zorunludur ve en az 5 karakter olmalıdır.',
      );
    }

    if (!inv.canCancel()) {
      throw new BadRequestException('Bu fatura zaten iptal edilmiştir.');
    }

    // 48 saatlik mali denetim ve kasa güvenliği zaman kilidi
    const referenceDate =
      inv.workOrder?.completedAt || inv.issueDate || inv.createdAt;
    if (referenceDate) {
      const elapsedMs = Date.now() - new Date(referenceDate).getTime();
      const fortyEightHoursMs = 48 * 60 * 60 * 1000;
      if (elapsedMs > fortyEightHoursMs) {
        throw new BadRequestException(
          'Bu iş emri tamamlanalı 48 saatten fazla olduğu için muhasebe ve denetim güvenliği gereği geri açılamaz. Lütfen düzeltme veya ilave işlemler için yeni bir iş emri oluşturun.',
        );
      }
    }

    const cancelled = await this.invoiceRepository.cancelWithCariReversal(
      tenantId,
      id,
      reason.trim(),
    );

    // E-Fatura sağlayıcısında resmi iptal talebi oluşturma
    if (this.providerFactory && inv.eInvoiceUuid) {
      try {
        const provider = await this.providerFactory.getProvider(tenantId);
        await provider.cancelInvoice(inv.eInvoiceUuid, reason.trim());
      } catch (provErr) {
        console.warn('Provider cancellation sync error:', provErr);
      }
    }

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
          paidAmount: inv.paidAmount,
        },
        changesAfter: {
          status: 'CANCELLED',
          reason: reason.trim(),
          transferredToAdvance: inv.paidAmount,
        },
      });
    } catch (err) {
      console.error('Audit log failed for invoice.cancelled:', err);
    }

    return cancelled;
  }
}
