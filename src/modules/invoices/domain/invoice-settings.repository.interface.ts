import { InvoiceProviderType } from './invoice-provider-type.enum';

export const INVOICE_SETTINGS_REPOSITORY = Symbol(
  'INVOICE_SETTINGS_REPOSITORY',
);

export interface InvoiceSettingRecord {
  tenantId: string;
  provider: InvoiceProviderType | string;
  encryptedApiKey: string | null;
  encryptedApiSecret: string | null;
  encryptedUsername: string | null;
  encryptedPassword: string | null;
  companyTaxId: string | null;
  taxOffice: string | null;
  seriesPrefix: string | null;
  isTestMode: boolean;
  autoSendOnCompletion: boolean;
}

/**
 * Fatura ayarları repository arayüzü.
 * Application katmanı bu arayüzü kullanır; Infrastructure PrismaService bunu uygular.
 */
export interface IInvoiceSettingsRepository {
  findByTenantId(tenantId: string): Promise<InvoiceSettingRecord | null>;

  upsert(
    tenantId: string,
    data: {
      provider: InvoiceProviderType | string;
      encryptedApiKey?: string | null;
      encryptedApiSecret?: string | null;
      encryptedUsername?: string | null;
      encryptedPassword?: string | null;
      companyTaxId?: string | null;
      taxOffice?: string | null;
      seriesPrefix?: string | null;
      isTestMode?: boolean;
      autoSendOnCompletion?: boolean;
    },
  ): Promise<InvoiceSettingRecord>;
}
