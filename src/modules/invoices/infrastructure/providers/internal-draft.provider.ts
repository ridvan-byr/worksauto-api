import { randomUUID } from 'crypto';
import {
  IEInvoiceProvider,
  ConnectionTestResult,
  CustomerTaxType,
  CreateEInvoicePayload,
  EInvoiceResult,
} from '../../domain/einvoice-provider.interface';

export class InternalDraftProvider implements IEInvoiceProvider {
  readonly providerName = 'INTERNAL';

  constructor(private readonly tenantId: string) {}

  async testConnection(): Promise<ConnectionTestResult> {
    return {
      success: true,
      message:
        'Dahili Sistem Fatura Modu Aktif (Harici entegratör bağımlılığı yok).',
    };
  }

  async checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType> {
    if (!taxNumber) return 'E_ARSIV';
    const clean = taxNumber.replace(/\D/g, '');
    // 10 haneli VKN kurumsal, 11 haneli TCKN bireysel varsayılır
    return clean.length === 10 ? 'E_FATURA' : 'E_ARSIV';
  }

  async createInvoice(payload: CreateEInvoicePayload): Promise<EInvoiceResult> {
    const draftUuid = randomUUID();
    const series = payload.seriesPrefix || 'DRAFT';
    const gibNumber = `${series}${new Date().getFullYear()}${String(Date.now()).slice(-9)}`;

    return {
      success: true,
      provider: this.providerName,
      eInvoiceUuid: draftUuid,
      gibInvoiceNumber: gibNumber,
      eInvoiceStatus: 'COMPLETED',
      errorMessage: undefined,
    };
  }

  async cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Dahili fatura (#${eInvoiceUuid}) başarıyla iptal edildi. Gerekçe: ${reason}`,
    };
  }

  async getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }> {
    return {
      htmlContent: `<div style="font-family: sans-serif; padding: 20px;"><h2>Dahili Servis Fatura Taslağı</h2><p>UUID: ${eInvoiceUuid}</p></div>`,
    };
  }
}
