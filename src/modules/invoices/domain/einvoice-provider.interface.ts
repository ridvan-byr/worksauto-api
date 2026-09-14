export type CustomerTaxType = 'E_FATURA' | 'E_ARSIV';

export interface CreateEInvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  kdvRate: number;
  totalPrice: number;
  notes?: string;
}

export interface CreateEInvoicePayload {
  invoiceId: string;
  invoiceNumber: string;
  seriesPrefix?: string;
  issueDate: Date;
  dueDate: Date;
  customer: {
    name: string;
    companyTitle?: string;
    taxNumber?: string;
    taxOffice?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    district?: string;
  };
  vehicle?: {
    plate?: string;
    brand?: string;
    model?: string;
    year?: number;
    vin?: string;
    currentKm?: number;
  };
  items: CreateEInvoiceItem[];
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
  isPaid: boolean;
  paymentMethod?: string;
  paidAmount?: number;
  notes?: string;
  profileId?: 'TICARIFATURA' | 'TEMELFATURA' | 'EARSIVFATURA';
}

export interface EInvoiceResult {
  success: boolean;
  provider: string;
  eInvoiceUuid: string;
  gibInvoiceNumber: string;
  eInvoiceStatus: 'DRAFT' | 'QUEUED' | 'PENDING_GIB' | 'COMPLETED' | 'FAILED';
  pdfUrl?: string;
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  balance?: number;
}

export interface IEInvoiceProvider {
  readonly providerName: string;

  testConnection(): Promise<ConnectionTestResult>;

  checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType>;

  createInvoice(payload: CreateEInvoicePayload): Promise<EInvoiceResult>;

  cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }>;

  getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }>;
}
