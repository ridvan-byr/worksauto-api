import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { ServicesModule } from './modules/services/services.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { RolesGuard } from './shared/guards/roles.guard';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';

import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CurrentAccountsModule } from './modules/current-accounts/current-accounts.module';
import { MediaModule } from './modules/media/media.module';
import { StaffModule } from './modules/staff/staff.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AdminModule } from './modules/admin/admin.module';
import { EventsModule } from './modules/events/events.module';
import { QueueModule } from './modules/queues/queue.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

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
    EventsModule,
    QueueModule,
    NotificationsModule,
    AuthModule,
    CustomersModule,
    VehiclesModule,
    AppointmentsModule,
    InventoryModule,
    WorkOrdersModule,
    InvoicesModule,
    PaymentsModule,
    CurrentAccountsModule,
    MediaModule,
    StaffModule,
    DashboardModule,
    TenantsModule,
    AuditModule,
    AdminModule,
    ServicesModule,
    HealthModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [PrismaService, RedisModule],
})
export class AppModule {}
