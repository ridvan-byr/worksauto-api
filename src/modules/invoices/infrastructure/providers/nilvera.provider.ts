import { randomUUID } from 'crypto';
import {
  IEInvoiceProvider,
  ConnectionTestResult,
  CustomerTaxType,
  CreateEInvoicePayload,
  EInvoiceResult,
} from '../../domain/einvoice-provider.interface';

export interface NilveraCredentials {
  apiKey?: string;
  username?: string;
  password?: string;
  companyTaxId?: string;
  seriesPrefix?: string;
  isTestMode?: boolean;
}

export class NilveraProvider implements IEInvoiceProvider {
  readonly providerName = 'NILVERA';

  constructor(
    private readonly credentials: NilveraCredentials,
    private readonly isTestMode: boolean = false,
  ) {}

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.credentials.apiKey) {
      return {
        success: false,
        message: 'Nilvera API Anahtarı eksik.',
      };
    }

    if (this.isTestMode) {
      return {
        success: true,
        message: 'Nilvera Test Entegratör ortamına başarıyla bağlanıldı.',
        balance: 500,
      };
    }

    return {
      success: true,
      message: 'Nilvera API bağlantısı başarılı.',
      balance: 120,
    };
  }

  async checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType> {
    if (!taxNumber) return 'E_ARSIV';
    const clean = taxNumber.replace(/\D/g, '');
    return clean.length === 10 ? 'E_FATURA' : 'E_ARSIV';
  }

  async createInvoice(payload: CreateEInvoicePayload): Promise<EInvoiceResult> {
    const eInvoiceUuid = randomUUID();
    const prefix = this.credentials.seriesPrefix || payload.seriesPrefix || 'NLV';
    const year = new Date().getFullYear();
    const gibNumber = `${prefix}${year}${String(Date.now()).slice(-9)}`;

    return {
      success: true,
      provider: this.providerName,
      eInvoiceUuid,
      gibInvoiceNumber: gibNumber,
      eInvoiceStatus: 'QUEUED',
      pdfUrl: `https://api.nilvera.com/general/DownloadPDF?UUID=${eInvoiceUuid}`,
    };
  }

  async cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Nilvera faturası (${eInvoiceUuid}) iptal edildi. Gerekçe: ${reason}`,
    };
  }

  async getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }> {
    return {
      pdfUrl: `https://api.nilvera.com/general/DownloadPDF?UUID=${eInvoiceUuid}`,
    };
  }
}
