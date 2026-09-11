import { InvoiceEntity } from './invoice.entity';

export const INVOICE_REPOSITORY = 'IInvoiceRepository';

export interface CreateInvoiceTransactionResult {
  invoice: InvoiceEntity;
  newBalance: number;
  creditLimit: number;
  customerName: string;
}

export interface IInvoiceRepository {
  findById(tenantId: string, id: string): Promise<InvoiceEntity | null>;
  findAll(tenantId: string, status?: string): Promise<InvoiceEntity[]>;
  findByWorkOrderId(
    tenantId: string,
    workOrderId: string,
  ): Promise<InvoiceEntity | null>;
  getNextInvoiceNumber(
    tenantId: string,
  ): Promise<{ invoiceNumber: string; gibInvoiceNumber: string }>;
  createWithCariMovement(
    invoice: InvoiceEntity,
  ): Promise<CreateInvoiceTransactionResult>;
  cancelWithCariReversal(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<InvoiceEntity>;
}
