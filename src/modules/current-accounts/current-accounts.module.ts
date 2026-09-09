import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CurrentAccountsController } from './current-accounts.controller';
import { CURRENT_ACCOUNT_REPOSITORY } from './domain/current-account.repository.interface';
import { PrismaCurrentAccountRepository } from './infrastructure/prisma-current-account.repository';
import { GetCurrentAccountsUseCase } from './application/use-cases/get-current-accounts.use-case';
import { GetCustomerCurrentAccountUseCase } from './application/use-cases/get-customer-current-account.use-case';

@Module({
  controllers: [CurrentAccountsController],
  providers: [
    PrismaService,
    {
      provide: CURRENT_ACCOUNT_REPOSITORY,
      useClass: PrismaCurrentAccountRepository,
    },
    GetCurrentAccountsUseCase,
    GetCustomerCurrentAccountUseCase,
  ],
  exports: [
    CURRENT_ACCOUNT_REPOSITORY,
    GetCurrentAccountsUseCase,
    GetCustomerCurrentAccountUseCase,
  ],
})
export class CurrentAccountsModule {}
