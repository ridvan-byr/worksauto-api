import { InvoicesModule } from '../invoices/invoices.module';
import { Module } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { InventoryModule } from '../inventory/inventory.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queues/queue.module';

@Module({
  imports: [
    InventoryModule,
    InvoicesModule,
    EventsModule,
    NotificationsModule,
    QueueModule,
  ],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, PrismaService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
