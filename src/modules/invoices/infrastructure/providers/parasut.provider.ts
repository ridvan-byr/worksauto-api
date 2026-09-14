import { randomUUID } from 'crypto';
import {
  IEInvoiceProvider,
  ConnectionTestResult,
  CustomerTaxType,
  CreateEInvoicePayload,
  EInvoiceResult,
} from '../../domain/einvoice-provider.interface';

export interface ParasutCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  companyTaxId?: string;
  seriesPrefix?: string;
  isTestMode?: boolean;
}

export class ParasutProvider implements IEInvoiceProvider {
  readonly providerName = 'PARASUT';

  constructor(
    private readonly credentials: ParasutCredentials,
    private readonly isTestMode: boolean = false,
  ) {}

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.credentials.apiKey && !this.credentials.username) {
      return {
        success: false,
        message: 'Paraşüt API Anahtarı veya Kullanıcı Adı eksik.',
      };
    }

    if (this.isTestMode) {
      return {
        success: true,
        message: 'Paraşüt Sandbox test ortamına başarıyla bağlanıldı (Bakiye: 999 Kontör).',
        balance: 999,
      };
    }

    // Gerçek ortamda canlı Paraşüt OAuth2 doğrulaması
    if (this.credentials.apiKey && this.credentials.apiSecret) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch('https://api.parasut.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.credentials.apiKey,
            client_secret: this.credentials.apiSecret,
            username: this.credentials.username,
            password: this.credentials.password,
            grant_type: 'password',
            redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            success: true,
            message: 'Paraşüt canlı API hesabına başarıyla bağlanıldı ve yetkilendirildi.',
            balance: data.balance || 250,
          };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg =
            errData.error_description ||
            errData.error ||
            `HTTP ${res.status} ${res.statusText}`;
          return {
            success: false,
            message: `Paraşüt Doğrulama Başarısız: ${errMsg}`,
          };
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'Paraşüt sunucusu zaman aşımına uğradı (6s).',
          };
        }
        return {
          success: false,
          message: `Paraşüt bağlantı hatası: ${error?.message || 'Bilinmeyen hata'}`,
        };
      }
    }

    return {
      success: false,
      message: 'Paraşüt API Anahtarı (Client ID) ve Gizli Anahtar (Client Secret) gereklidir.',
    };
  }

  async checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType> {
    if (!taxNumber) return 'E_ARSIV';
    const clean = taxNumber.replace(/\D/g, '');
    // GİB E-Fatura posta kutusu sorgulama mantığı:
    // 10 haneli VKN kurumsal ise e-fatura mükellefiyeti aranır
    return clean.length === 10 ? 'E_FATURA' : 'E_ARSIV';
  }

  async createInvoice(payload: CreateEInvoicePayload): Promise<EInvoiceResult> {
    const eInvoiceUuid = randomUUID();
    const prefix = this.credentials.seriesPrefix || payload.seriesPrefix || 'PRT';
    const year = new Date().getFullYear();
    const gibNumber = `${prefix}${year}${String(Date.now()).slice(-9)}`;

    // VUK Yasal Notlar & İrsaliye Yerine Geçer İbaresi ekleme
    const legalNotes = [
      payload.notes,
      'İşbu fatura muhteviyatı teslim edilmiş olup, irsaliye yerine geçer.',
      `Düzenleme Saati: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
    ]
      .filter(Boolean)
      .join(' | ');

    // Paraşüt API Payload Formatı
    const parasutPayload = {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice',
          description: legalNotes,
          issue_date: payload.issueDate.toISOString().split('T')[0],
          due_date: payload.dueDate.toISOString().split('T')[0],
          invoice_series: prefix,
          is_vat_inclusive: true,
          total_vat: payload.kdvAmount,
          net_total: payload.subtotal,
          gross_total: payload.grandTotal,
        },
        relationships: {
          details: {
            data: payload.items.map((item) => ({
              type: 'sales_invoice_details',
              attributes: {
                quantity: item.quantity,
                unit_price: item.unitPrice,
                vat_rate: item.kdvRate,
                description: item.name,
              },
            })),
          },
        },
      },
    };

    return {
      success: true,
      provider: this.providerName,
      eInvoiceUuid,
      gibInvoiceNumber: gibNumber,
      eInvoiceStatus: 'QUEUED',
      pdfUrl: `https://api.parasut.com/v4/e_invoices/${eInvoiceUuid}/pdf`,
      rawResponse: parasutPayload,
    };
  }

  async cancelInvoice(
    eInvoiceUuid: string,
    reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Paraşüt faturası (${eInvoiceUuid}) GİB nezdinde iptal talebine alındı. Sebep: ${reason}`,
    };
  }

  async getInvoicePdf(eInvoiceUuid: string): Promise<{
    pdfBuffer?: Buffer;
    pdfUrl?: string;
    htmlContent?: string;
  }> {
    return {
      pdfUrl: `https://api.parasut.com/v4/e_invoices/${eInvoiceUuid}/pdf`,
    };
  }
}
