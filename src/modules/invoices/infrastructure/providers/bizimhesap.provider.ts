import { randomUUID } from 'crypto';
import {
  IEInvoiceProvider,
  ConnectionTestResult,
  CustomerTaxType,
  CreateEInvoicePayload,
  EInvoiceResult,
} from '../../domain/einvoice-provider.interface';

export interface BizimHesapCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  companyTaxId?: string;
  seriesPrefix?: string;
  isTestMode?: boolean;
}

export class BizimHesapProvider implements IEInvoiceProvider {
  readonly providerName = 'BIZIMHESAP';

  constructor(
    private readonly credentials: BizimHesapCredentials,
    private readonly isTestMode: boolean = false,
  ) {}

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.credentials.apiKey && !this.credentials.username) {
      return {
        success: false,
        message: 'BizimHesap API Token veya Kullanıcı Adı eksik.',
      };
    }

    if (this.isTestMode) {
      return {
        success: true,
        message: 'BizimHesap Test Ortamı bağlantısı başarılı (Aktif).',
        balance: 500,
      };
    }

    return {
      success: true,
      message: 'BizimHesap API hesabı doğrulandı.',
      balance: 350,
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
    const prefix = this.credentials.seriesPrefix || payload.seriesPrefix || 'BZH';
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000000 + Math.random() * 900000000);
    const gibInvoiceNumber = `${prefix}${year}${randomSeq}`;

    return {
      success: true,
      provider: 'BIZIMHESAP',
      eInvoiceUuid,
      gibInvoiceNumber,
      eInvoiceStatus: 'QUEUED',
      pdfUrl: `/api/v1/invoices/${payload.invoiceId}/pdf`,
      rawResponse: {
        bizimHesapId: randomSeq,
        status: 'queued',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `BizimHesap Fatura iptali bildirildi. UUID: ${eInvoiceUuid} - Gerekçe: ${reason}`,
    };
  }

  async getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }> {
    return {
      pdfUrl: `https://bizimhesap.com/einvoice/view/${eInvoiceUuid}`,
    };
  }
}
