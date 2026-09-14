import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CryptoService } from '../../shared/infrastructure/crypto/crypto.service';

import { INVOICE_REPOSITORY } from './domain/invoice.repository.interface';
import { EINVOICE_PROVIDER_FACTORY } from './domain/einvoice-provider-factory.interface';
import { CRYPTO_SERVICE } from './domain/crypto-service.interface';
import { INVOICE_SETTINGS_REPOSITORY } from './domain/invoice-settings.repository.interface';

import { PrismaInvoiceRepository } from './infrastructure/prisma-invoice.repository';
import { PrismaInvoiceSettingsRepository } from './infrastructure/prisma-invoice-settings.repository';
import { EInvoiceProviderFactory } from './infrastructure/providers/einvoice-provider.factory';

import { InvoicesController } from './presentation/invoices.controller';
import { InvoiceSettingsController } from './presentation/invoice-settings.controller';
import { GetInvoicesUseCase } from './application/use-cases/get-invoices.use-case';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { CancelInvoiceUseCase } from './application/use-cases/cancel-invoice.use-case';
import { InvoiceSettingsService } from './application/invoice-settings.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [InvoicesController, InvoiceSettingsController],
  providers: [
    PrismaService,
    CryptoService,
    // Domain Interface → Infrastructure Implementation Bindings (Dependency Inversion)
    {
      provide: CRYPTO_SERVICE,
      useClass: CryptoService,
    },
    {
      provide: INVOICE_REPOSITORY,
      useClass: PrismaInvoiceRepository,
    },
    {
      provide: INVOICE_SETTINGS_REPOSITORY,
      useClass: PrismaInvoiceSettingsRepository,
    },
    {
      provide: EINVOICE_PROVIDER_FACTORY,
      useClass: EInvoiceProviderFactory,
    },
    // Application Services & Use Cases
    InvoiceSettingsService,
    GetInvoicesUseCase,
    CreateInvoiceUseCase,
    CancelInvoiceUseCase,
  ],
  exports: [
    INVOICE_REPOSITORY,
    EINVOICE_PROVIDER_FACTORY,
    GetInvoicesUseCase,
    CreateInvoiceUseCase,
    CancelInvoiceUseCase,
    InvoiceSettingsService,
  ],
})
export class InvoicesModule {}
