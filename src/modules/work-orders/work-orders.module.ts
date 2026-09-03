import { Module } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, PrismaService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
