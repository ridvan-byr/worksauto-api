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
    return {
      success: false,
      message:
        'Bu sağlayıcının canlı e-fatura entegrasyonu henüz kullanıma hazır değil.',
    };
  }

  async checkCustomerTaxType(taxNumber: string): Promise<CustomerTaxType> {
    if (!taxNumber) return 'E_ARSIV';
    const clean = taxNumber.replace(/\D/g, '');
    return clean.length === 10 ? 'E_FATURA' : 'E_ARSIV';
  }

  async createInvoice(
    _payload: CreateEInvoicePayload,
  ): Promise<EInvoiceResult> {
    return {
      success: false,
      provider: this.providerName,
      eInvoiceUuid: '',
      gibInvoiceNumber: '',
      eInvoiceStatus: 'FAILED',
      errorMessage:
        'Live invoice submission is not implemented for this provider.',
    };
  }

  async cancelInvoice(
    _eInvoiceUuid: string,
    _reason: string,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message:
        'Live invoice cancellation is not implemented for this provider.',
    };
  }

  async getInvoicePdf(
    _eInvoiceUuid: string,
  ): Promise<{ pdfBuffer?: Buffer; pdfUrl?: string; htmlContent?: string }> {
    throw new Error(
      'Bu sağlayıcı için doğrulanmış e-fatura PDF indirme desteği henüz hazır değil.',
    );
  }
}
