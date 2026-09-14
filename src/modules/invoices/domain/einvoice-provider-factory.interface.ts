import { IEInvoiceProvider } from './einvoice-provider.interface';
import { InvoiceProviderType } from './invoice-provider-type.enum';

export const EINVOICE_PROVIDER_FACTORY = Symbol('EINVOICE_PROVIDER_FACTORY');

/**
 * E-Fatura sağlayıcı fabrikası domain arayüzü.
 * Application katmanı bu arayüzü kullanır; Infrastructure katmanı bunu uygular.
 * Clean Architecture: Dependency Inversion Principle
 */
export interface IEInvoiceProviderFactory {
  /**
   * Servisin veritabanında kayıtlı sağlayıcı yapılandırmasına göre
   * uygun provider instance'ı döndürür.
   */
  getProvider(tenantId: string): Promise<IEInvoiceProvider>;

  /**
   * Ayarlar ekranından henüz DB'ye kaydedilmeden
   * "Bağlantıyı Test Et" yapılabilmesi için kullanılır.
   */
  getProviderFromInput(
    providerType: InvoiceProviderType,
    credentials: {
      apiKey?: string;
      apiSecret?: string;
      username?: string;
      password?: string;
      companyTaxId?: string;
      seriesPrefix?: string;
      isTestMode?: boolean;
    },
  ): IEInvoiceProvider;
}
