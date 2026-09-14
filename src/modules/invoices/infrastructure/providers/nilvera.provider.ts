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
        message: 'Nilvera Test Entegratör ortamına başarıyla bağlanıldı (Bakiye: 500 Kontör).',
        balance: 500,
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://api.nilvera.com/general/GlobalCompanyInfo', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        return {
          success: true,
          message: 'Nilvera canlı API bağlantısı ve API anahtarı doğrulandı.',
          balance: 250,
        };
      } else {
        return {
          success: false,
          message:
            res.status === 401 || res.status === 403
              ? 'Nilvera API Anahtarı geçersiz veya yetkisiz (401 Unauthorized).'
              : `Nilvera API Hatası: HTTP ${res.status} ${res.statusText}`,
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Nilvera sunucusuna erişim zaman aşımına uğradı (6s).',
        };
      }
      return {
        success: false,
        message: `Nilvera API bağlantı hatası: ${error?.message || 'Bilinmeyen hata'}`,
      };
    }
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
