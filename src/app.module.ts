import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import { RedisService } from './shared/infrastructure/redis/redis.service';
import { RolesGuard } from './shared/guards/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CurrentAccountsModule } from './modules/current-accounts/current-accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    CustomersModule,
    VehiclesModule,
    AppointmentsModule,
    InventoryModule,
    WorkOrdersModule,
    InvoicesModule,
    PaymentsModule,
    CurrentAccountsModule,
  ],
  providers: [
    PrismaService,
    RedisService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [PrismaService, RedisService],
})
export class AppModule {}
