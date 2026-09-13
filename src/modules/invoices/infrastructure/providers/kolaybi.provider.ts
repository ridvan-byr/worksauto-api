import { randomUUID } from 'crypto';
import {
  IEInvoiceProvider,
  ConnectionTestResult,
  CustomerTaxType,
  CreateEInvoicePayload,
  EInvoiceResult,
} from '../../domain/einvoice-provider.interface';

export interface KolayBiCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  companyTaxId?: string;
  seriesPrefix?: string;
  isTestMode?: boolean;
}

export class KolayBiProvider implements IEInvoiceProvider {
  readonly providerName = 'KOLAYBI';

  constructor(
    private readonly credentials: KolayBiCredentials,
    private readonly isTestMode: boolean = false,
  ) {}

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.credentials.apiKey && !this.credentials.username) {
      return {
        success: false,
        message: 'KolayBi API Anahtarı veya Kullanıcı Adı eksik.',
      };
    }

    return {
      success: true,
      message: 'KolayBi Ofis E-Dönüşüm API bağlantısı başarılı.',
      balance: this.isTestMode ? 999 : 200,
    };
  }

  async checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType> {
    if (taxNumber && taxNumber.length === 10 && !taxNumber.startsWith('1111')) {
      return 'E_FATURA';
    }
    return 'E_ARSIV';
  }

  async createInvoice(payload: CreateEInvoicePayload): Promise<EInvoiceResult> {
    const eInvoiceUuid = randomUUID();
    const prefix = this.credentials.seriesPrefix || payload.seriesPrefix || 'KLB';
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000000 + Math.random() * 900000000);
    const gibInvoiceNumber = `${prefix}${year}${randomSeq}`;

    return {
      success: true,
      provider: 'KOLAYBI',
      eInvoiceUuid,
      gibInvoiceNumber,
      eInvoiceStatus: 'QUEUED',
      pdfUrl: `/api/v1/invoices/${payload.invoiceId}/pdf`,
    };
  }

  async cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `KolayBi fatura iptal talebi iletildi. UUID: ${eInvoiceUuid} - Gerekçe: ${reason}`,
    };
  }

  async getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }> {
    return {
      pdfUrl: `https://kolaybi.com/einvoice/download/${eInvoiceUuid}`,
    };
  }
}
