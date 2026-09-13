import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CryptoService } from '../../shared/infrastructure/crypto/crypto.service';

import { INVOICE_REPOSITORY } from './domain/invoice.repository.interface';
import { PrismaInvoiceRepository } from './infrastructure/prisma-invoice.repository';

import { InvoicesController } from './presentation/invoices.controller';
import { InvoiceSettingsController } from './presentation/invoice-settings.controller';
import { GetInvoicesUseCase } from './application/use-cases/get-invoices.use-case';
import { CreateInvoiceUseCase } from './application/use-cases/create-invoice.use-case';
import { CancelInvoiceUseCase } from './application/use-cases/cancel-invoice.use-case';
import { InvoiceSettingsService } from './application/invoice-settings.service';
import { EInvoiceProviderFactory } from './infrastructure/providers/einvoice-provider.factory';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [InvoicesController, InvoiceSettingsController],
  providers: [
    PrismaService,
    CryptoService,
    EInvoiceProviderFactory,
    InvoiceSettingsService,
    {
      provide: INVOICE_REPOSITORY,
      useClass: PrismaInvoiceRepository,
    },
    GetInvoicesUseCase,
    CreateInvoiceUseCase,
    CancelInvoiceUseCase,
  ],
  exports: [
    INVOICE_REPOSITORY,
    GetInvoicesUseCase,
    CreateInvoiceUseCase,
    CancelInvoiceUseCase,
    EInvoiceProviderFactory,
    InvoiceSettingsService,
  ],
})
export class InvoicesModule {}
