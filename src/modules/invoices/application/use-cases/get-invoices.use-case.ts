import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInvoiceRepository,
  INVOICE_REPOSITORY,
} from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';

@Injectable()
export class GetInvoicesUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY)
    private readonly invoiceRepository: IInvoiceRepository,
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
}
