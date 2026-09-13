import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CryptoService } from '../../../../shared/infrastructure/crypto/crypto.service';
import { IEInvoiceProvider } from '../../domain/einvoice-provider.interface';
import { InternalDraftProvider } from './internal-draft.provider';
import { ParasutProvider } from './parasut.provider';
import { NilveraProvider } from './nilvera.provider';
import { BizimHesapProvider } from './bizimhesap.provider';
import { KolayBiProvider } from './kolaybi.provider';
import { InvoiceProviderType } from '@prisma/client';

@Injectable()
export class EInvoiceProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async getProvider(tenantId: string): Promise<IEInvoiceProvider> {
    const config = await this.prisma.tenantInvoiceSetting.findUnique({
      where: { tenantId },
    });

    if (!config || config.provider === InvoiceProviderType.INTERNAL) {
      return new InternalDraftProvider(tenantId);
    }

    const decryptedApiKey = this.cryptoService.decrypt(config.encryptedApiKey) || undefined;
    const decryptedApiSecret = this.cryptoService.decrypt(config.encryptedApiSecret) || undefined;
    const decryptedUsername = this.cryptoService.decrypt(config.encryptedUsername) || undefined;
    const decryptedPassword = this.cryptoService.decrypt(config.encryptedPassword) || undefined;

    const creds = {
      apiKey: decryptedApiKey,
      apiSecret: decryptedApiSecret,
      username: decryptedUsername,
      password: decryptedPassword,
      companyTaxId: config.companyTaxId || undefined,
      seriesPrefix: config.seriesPrefix || undefined,
      isTestMode: config.isTestMode,
    };

    switch (config.provider) {
      case InvoiceProviderType.PARASUT:
        return new ParasutProvider(creds, config.isTestMode);

      case InvoiceProviderType.NILVERA:
        return new NilveraProvider(creds, config.isTestMode);

      case InvoiceProviderType.BIZIMHESAP:
        return new BizimHesapProvider(creds, config.isTestMode);

      case InvoiceProviderType.KOLAYBI:
        return new KolayBiProvider(creds, config.isTestMode);

      default:
        return new InternalDraftProvider(tenantId);
    }
  }

  // Ayarlar ekranından henüz DB'ye kaydedilmeden "Bağlantıyı Test Et" yapılabilmesi için
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
  ): IEInvoiceProvider {
    switch (providerType) {
      case InvoiceProviderType.PARASUT:
        return new ParasutProvider(credentials, credentials.isTestMode);
      case InvoiceProviderType.NILVERA:
        return new NilveraProvider(credentials, credentials.isTestMode);
      case InvoiceProviderType.BIZIMHESAP:
        return new BizimHesapProvider(credentials, credentials.isTestMode);
      case InvoiceProviderType.KOLAYBI:
        return new KolayBiProvider(credentials, credentials.isTestMode);
      default:
        return new InternalDraftProvider('temp');
    }
  }
}
