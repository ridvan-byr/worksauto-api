import { Module } from '@nestjs/common';
import { CurrentAccountsService } from './current-accounts.service';
import { CurrentAccountsController } from './current-accounts.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [CurrentAccountsController],
  providers: [CurrentAccountsService, PrismaService],
  exports: [CurrentAccountsService],
})
export class CurrentAccountsModule {}
