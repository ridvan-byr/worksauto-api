import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CryptoService } from '../../../shared/infrastructure/crypto/crypto.service';
import { EInvoiceProviderFactory } from '../infrastructure/providers/einvoice-provider.factory';
import {
  UpdateInvoiceSettingsDto,
  TestInvoiceConnectionDto,
} from '../dto/invoice-settings.dto';
import { InvoiceProviderType } from '@prisma/client';

@Injectable()
export class InvoiceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly providerFactory: EInvoiceProviderFactory,
  ) {}

  private maskString(val?: string | null): string | null {
    if (!val) return null;
    if (val.length <= 4) return '****';
    return `****${val.slice(-4)}`;
  }

  async getSettings(tenantId: string) {
    const config = await this.prisma.tenantInvoiceSetting.findUnique({
      where: { tenantId },
    });

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
    const decryptedUsername = this.cryptoService.decrypt(config.encryptedUsername);

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
    const existing = await this.prisma.tenantInvoiceSetting.findUnique({
      where: { tenantId },
    });

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

    await this.prisma.tenantInvoiceSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
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
      },
      update: {
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
      },
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
      const existing = await this.prisma.tenantInvoiceSetting.findUnique({
        where: { tenantId },
      });
      if (existing) {
        apiKey = apiKey || this.cryptoService.decrypt(existing.encryptedApiKey) || undefined;
        apiSecret = apiSecret || this.cryptoService.decrypt(existing.encryptedApiSecret) || undefined;
        username = username || this.cryptoService.decrypt(existing.encryptedUsername) || undefined;
        password = password || this.cryptoService.decrypt(existing.encryptedPassword) || undefined;
      }
    }

    const provider = this.providerFactory.getProviderFromInput(dto.provider, {
      apiKey,
      apiSecret,
      username,
      password,
      companyTaxId: dto.companyTaxId,
      isTestMode: dto.isTestMode,
    });

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
