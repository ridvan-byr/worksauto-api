import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CUSTOMER_REPOSITORY } from './domain/customer.repository.interface';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository';
import { CUSTOMER_CONSENT_REPOSITORY } from './domain/customer-consent.repository.interface';
import { PrismaCustomerConsentRepository } from './infrastructure/prisma-customer-consent.repository';
import { CustomersController } from './presentation/customers.controller';
import { GetCustomersUseCase } from './application/use-cases/get-customers.use-case';
import { CreateCustomerUseCase } from './application/use-cases/create-customer.use-case';
import { UpdateCustomerUseCase } from './application/use-cases/update-customer.use-case';
import { QuickLeadUseCase } from './application/use-cases/quick-lead.use-case';
import { BatchImportCustomersUseCase } from './application/use-cases/batch-import-customers.use-case';
import { AnonymizeCustomerUseCase } from './application/use-cases/anonymize-customer.use-case';

import { ConsentPublicController } from './presentation/consent-public.controller';
import { ManageConsentUseCase } from './application/use-cases/manage-consent.use-case';

@Module({
  controllers: [CustomersController, ConsentPublicController],
  providers: [
    PrismaService,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
    {
      provide: CUSTOMER_CONSENT_REPOSITORY,
      useClass: PrismaCustomerConsentRepository,
    },
    GetCustomersUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    QuickLeadUseCase,
    BatchImportCustomersUseCase,
    AnonymizeCustomerUseCase,
    ManageConsentUseCase,
  ],
  exports: [
    CUSTOMER_REPOSITORY,
    CUSTOMER_CONSENT_REPOSITORY,
    GetCustomersUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    QuickLeadUseCase,
    BatchImportCustomersUseCase,
    AnonymizeCustomerUseCase,
    ManageConsentUseCase,
  ],
})
export class CustomersModule {}
