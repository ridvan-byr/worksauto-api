export type InvoiceStatusType =
  'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceProps {
  id?: string;
  tenantId: string;
  workOrderId?: string;
  customerId: string;
  invoiceNumber: string;
  issueDate?: Date;
  dueDate: Date;
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
  paidAmount?: number;
  remainingAmount?: number;
  status?: InvoiceStatusType;
  gibInvoiceNumber?: string;
  eInvoiceStatus?: string;
  eInvoiceUuid?: string;
  createdAt?: Date;
  updatedAt?: Date;
  customer?: any;
  workOrder?: any;
  payments?: any[];
}

export class InvoiceEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly workOrderId?: string;
  public readonly customerId: string;
  public readonly invoiceNumber: string;
  public issueDate: Date;
  public dueDate: Date;
  public subtotal: number;
  public kdvAmount: number;
  public grandTotal: number;
  public paidAmount: number;
  public remainingAmount: number;
  public status: InvoiceStatusType;
  public gibInvoiceNumber?: string;
  public eInvoiceStatus?: string;
  public eInvoiceUuid?: string;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public customer?: any;
  public workOrder?: any;
  public payments?: any[];

  constructor(props: InvoiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.workOrderId = props.workOrderId;
    this.customerId = props.customerId;
    this.invoiceNumber = props.invoiceNumber;
    this.issueDate = props.issueDate || new Date();
    this.dueDate = props.dueDate;
    this.subtotal = props.subtotal;
    this.kdvAmount = props.kdvAmount;
    this.grandTotal = props.grandTotal;
    this.paidAmount = props.paidAmount ?? 0;
    this.remainingAmount = props.remainingAmount ?? props.grandTotal;
    this.status = props.status || 'UNPAID';
    this.gibInvoiceNumber = props.gibInvoiceNumber;
    this.eInvoiceStatus = props.eInvoiceStatus;
    this.eInvoiceUuid = props.eInvoiceUuid;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.customer = props.customer;
    this.workOrder = props.workOrder;
    this.payments = props.payments;
  }

  public canCancel(): boolean {
    return (
      this.status !== 'PAID' &&
      this.paidAmount === 0 &&
      this.status !== 'CANCELLED'
    );
  }

  public cancel(): void {
    if (!this.canCancel()) {
      throw new Error(
        'Ödemesi tamamlanmış veya tahsilat yapılmış bir fatura doğrudan iptal edilemez.',
      );
    }
    this.status = 'CANCELLED';
  }

  public recordPayment(amount: number): void {
    if (amount <= 0) {
      throw new Error('Ödeme miktarı 0 dan büyük olmalıdır.');
    }
    if (amount > this.remainingAmount) {
      throw new Error(
        `Ödeme tutarı (${amount}) kalan bakiyeden (${this.remainingAmount}) fazla olamaz.`,
      );
    }

    this.paidAmount += amount;
    this.remainingAmount = Number(
      (this.grandTotal - this.paidAmount).toFixed(2),
    );
    this.status = this.remainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  }

  public isOverdue(): boolean {
    if (this.status === 'PAID' || this.status === 'CANCELLED') return false;
    return new Date() > this.dueDate;
  }
}
