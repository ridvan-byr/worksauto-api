import { Injectable, Inject } from '@nestjs/common';
import {
  IInvoiceSettingsRepository,
  INVOICE_SETTINGS_REPOSITORY,
} from '../domain/invoice-settings.repository.interface';
import {
  ICryptoService,
  CRYPTO_SERVICE,
} from '../domain/crypto-service.interface';
import {
  IEInvoiceProviderFactory,
  EINVOICE_PROVIDER_FACTORY,
} from '../domain/einvoice-provider-factory.interface';
import {
  UpdateInvoiceSettingsDto,
  TestInvoiceConnectionDto,
} from '../dto/invoice-settings.dto';
import { InvoiceProviderType } from '../domain/invoice-provider-type.enum';

@Injectable()
export class InvoiceSettingsService {
  constructor(
    @Inject(INVOICE_SETTINGS_REPOSITORY)
    private readonly settingsRepo: IInvoiceSettingsRepository,
    @Inject(CRYPTO_SERVICE)
    private readonly cryptoService: ICryptoService,
    @Inject(EINVOICE_PROVIDER_FACTORY)
    private readonly providerFactory: IEInvoiceProviderFactory,
  ) {}

  private maskString(val?: string | null): string | null {
    if (!val) return null;
    if (val.length <= 4) return '****';
    return `****${val.slice(-4)}`;
  }

  async getSettings(tenantId: string) {
    const config = await this.settingsRepo.findByTenantId(tenantId);

    if (!config) {
      return {
        provider: InvoiceProviderType.INTERNAL,
        hasApiKey: false,
        hasApiSecret: false,
        hasPassword: false,
        username: null,
        companyTaxId: null,
        taxOffice: null,
        seriesPrefix: 'ATW',
        isTestMode: false,
        autoSendOnCompletion: false,
      };
    }

    const decryptedApiKey = this.cryptoService.decrypt(config.encryptedApiKey);
    const decryptedUsername = this.cryptoService.decrypt(
      config.encryptedUsername,
    );

    return {
      provider: config.provider,
      hasApiKey: !!config.encryptedApiKey,
      hasApiSecret: !!config.encryptedApiSecret,
      hasPassword: !!config.encryptedPassword,
      maskedApiKey: this.maskString(decryptedApiKey),
      username: decryptedUsername || null,
      companyTaxId: config.companyTaxId,
      taxOffice: config.taxOffice,
      seriesPrefix: config.seriesPrefix || 'ATW',
      isTestMode: config.isTestMode,
      autoSendOnCompletion: config.autoSendOnCompletion,
    };
  }

  async updateSettings(tenantId: string, dto: UpdateInvoiceSettingsDto) {
    const existing = await this.settingsRepo.findByTenantId(tenantId);

    let encryptedApiKey = existing?.encryptedApiKey;
    if (dto.apiKey !== undefined) {
      encryptedApiKey = dto.apiKey.trim()
        ? this.cryptoService.encrypt(dto.apiKey.trim())
        : null;
    }

    let encryptedApiSecret = existing?.encryptedApiSecret;
    if (dto.apiSecret !== undefined) {
      encryptedApiSecret = dto.apiSecret.trim()
        ? this.cryptoService.encrypt(dto.apiSecret.trim())
        : null;
    }

    let encryptedUsername = existing?.encryptedUsername;
    if (dto.username !== undefined) {
      encryptedUsername = dto.username.trim()
        ? this.cryptoService.encrypt(dto.username.trim())
        : null;
    }

    let encryptedPassword = existing?.encryptedPassword;
    if (dto.password !== undefined) {
      encryptedPassword = dto.password.trim()
        ? this.cryptoService.encrypt(dto.password.trim())
        : null;
    }

    await this.settingsRepo.upsert(tenantId, {
      provider: dto.provider,
      encryptedApiKey,
      encryptedApiSecret,
      encryptedUsername,
      encryptedPassword,
      companyTaxId: dto.companyTaxId?.trim() || null,
      taxOffice: dto.taxOffice?.trim() || null,
      seriesPrefix: dto.seriesPrefix?.trim() || 'ATW',
      isTestMode: dto.isTestMode ?? false,
      autoSendOnCompletion: dto.autoSendOnCompletion ?? false,
    });

    return this.getSettings(tenantId);
  }

  async testConnection(tenantId: string, dto: TestInvoiceConnectionDto) {
    // Eğer şifre/key ekranda boş bırakılmışsa ama DB'de kayıtlıysa, DB'dekini kullan
    let apiKey = dto.apiKey;
    let apiSecret = dto.apiSecret;
    let username = dto.username;
    let password = dto.password;

    if (!apiKey || !apiSecret) {
      const existing = await this.settingsRepo.findByTenantId(tenantId);
      if (existing) {
        apiKey =
          apiKey ||
          this.cryptoService.decrypt(existing.encryptedApiKey) ||
          undefined;
        apiSecret =
          apiSecret ||
          this.cryptoService.decrypt(existing.encryptedApiSecret) ||
          undefined;
        username =
          username ||
          this.cryptoService.decrypt(existing.encryptedUsername) ||
          undefined;
        password =
          password ||
          this.cryptoService.decrypt(existing.encryptedPassword) ||
          undefined;
      }
    }

    const provider = this.providerFactory.getProviderFromInput(
      dto.provider as unknown as InvoiceProviderType,
      {
        apiKey,
        apiSecret,
        username,
        password,
        companyTaxId: dto.companyTaxId,
        isTestMode: dto.isTestMode,
      },
    );

    return provider.testConnection();
  }

  async checkCustomerTaxType(tenantId: string, taxNumber: string) {
    const provider = await this.providerFactory.getProvider(tenantId);
    const taxType = await provider.checkCustomerTaxType(taxNumber);
    return {
      taxNumber,
      taxType,
    };
  }
}
