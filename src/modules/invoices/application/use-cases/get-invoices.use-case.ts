import { Injectable, Inject, Optional, NotFoundException } from '@nestjs/common';
import {
  IInvoiceRepository,
  INVOICE_REPOSITORY,
} from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { EInvoiceProviderFactory } from '../../infrastructure/providers/einvoice-provider.factory';

@Injectable()
export class GetInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
    @Optional()
    private readonly providerFactory?: EInvoiceProviderFactory,
  ) {}

  async execute(tenantId: string, status?: string): Promise<InvoiceEntity[]> {
    return this.invoiceRepository.findAll(tenantId, status);
  }

  async getById(tenantId: string, id: string): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(tenantId, id);
    if (!invoice) {
      throw new NotFoundException('Fatura bulunamadı.');
    }
    return invoice;
  }

  async getPdf(tenantId: string, id: string) {
    const invoice = await this.getById(tenantId, id);
    if (!this.providerFactory) {
      return {
        pdfUrl: null,
        message: 'E-Fatura sağlayıcı servisi yapılandırılmamış.',
      };
    }
    const provider = await this.providerFactory.getProvider(tenantId);
    return provider.getInvoicePdf(invoice.eInvoiceUuid || invoice.id || id);
  }
}
