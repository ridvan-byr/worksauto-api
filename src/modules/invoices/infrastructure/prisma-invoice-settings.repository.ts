import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  IInvoiceSettingsRepository,
  InvoiceSettingRecord,
} from '../domain/invoice-settings.repository.interface';
import { InvoiceProviderType as PrismaProviderType } from '@prisma/client';

@Injectable()
export class PrismaInvoiceSettingsRepository implements IInvoiceSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenantId(tenantId: string): Promise<InvoiceSettingRecord | null> {
    const record = await this.prisma.tenantInvoiceSetting.findUnique({
      where: { tenantId },
    });
    if (!record) return null;
    return {
      tenantId: record.tenantId,
      provider: record.provider as string,
      encryptedApiKey: record.encryptedApiKey,
      encryptedApiSecret: record.encryptedApiSecret,
      encryptedUsername: record.encryptedUsername,
      encryptedPassword: record.encryptedPassword,
      companyTaxId: record.companyTaxId,
      taxOffice: record.taxOffice,
      seriesPrefix: record.seriesPrefix,
      isTestMode: record.isTestMode,
      autoSendOnCompletion: record.autoSendOnCompletion,
    };
  }

  async upsert(
    tenantId: string,
    data: {
      provider: string;
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
  ): Promise<InvoiceSettingRecord> {
    const record = await this.prisma.tenantInvoiceSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        provider: data.provider as PrismaProviderType,
        encryptedApiKey: data.encryptedApiKey ?? null,
        encryptedApiSecret: data.encryptedApiSecret ?? null,
        encryptedUsername: data.encryptedUsername ?? null,
        encryptedPassword: data.encryptedPassword ?? null,
        companyTaxId: data.companyTaxId ?? null,
        taxOffice: data.taxOffice ?? null,
        seriesPrefix: data.seriesPrefix ?? 'ATW',
        isTestMode: data.isTestMode ?? false,
        autoSendOnCompletion: data.autoSendOnCompletion ?? false,
      },
      update: {
        provider: data.provider as PrismaProviderType,
        encryptedApiKey: data.encryptedApiKey ?? undefined,
        encryptedApiSecret: data.encryptedApiSecret ?? undefined,
        encryptedUsername: data.encryptedUsername ?? undefined,
        encryptedPassword: data.encryptedPassword ?? undefined,
        companyTaxId: data.companyTaxId ?? undefined,
        taxOffice: data.taxOffice ?? undefined,
        seriesPrefix: data.seriesPrefix ?? undefined,
        isTestMode: data.isTestMode ?? undefined,
        autoSendOnCompletion: data.autoSendOnCompletion ?? undefined,
      },
    });
    return {
      tenantId: record.tenantId,
      provider: record.provider as string,
      encryptedApiKey: record.encryptedApiKey,
      encryptedApiSecret: record.encryptedApiSecret,
      encryptedUsername: record.encryptedUsername,
      encryptedPassword: record.encryptedPassword,
      companyTaxId: record.companyTaxId,
      taxOffice: record.taxOffice,
      seriesPrefix: record.seriesPrefix,
      isTestMode: record.isTestMode,
      autoSendOnCompletion: record.autoSendOnCompletion,
    };
  }
}
