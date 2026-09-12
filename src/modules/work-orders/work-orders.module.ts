import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queues/queue.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

import { WorkOrdersController } from './presentation/work-orders.controller';
import { PrismaWorkOrderRepository } from './infrastructure/persistence/prisma-work-order.repository';

import { GetWorkOrdersUseCase } from './application/use-cases/get-work-orders.use-case';
import { CreateWorkOrderUseCase } from './application/use-cases/create-work-order.use-case';
import { UpdateWorkOrderStatusUseCase } from './application/use-cases/update-work-order-status.use-case';
import { RollbackWorkOrderUseCase } from './application/use-cases/rollback-work-order.use-case';
import { AddWorkOrderItemUseCase } from './application/use-cases/add-work-order-item.use-case';
import { UpdateWorkOrderItemQuantityUseCase } from './application/use-cases/update-work-order-item-quantity.use-case';
import { RemoveWorkOrderItemUseCase } from './application/use-cases/remove-work-order-item.use-case';
import { AddWorkOrderPhotoUseCase } from './application/use-cases/add-work-order-photo.use-case';
import { AddWorkOrderNoteUseCase } from './application/use-cases/add-work-order-note.use-case';
import { UpdateWorkOrderNoteUseCase } from './application/use-cases/update-work-order-note.use-case';
import { DeleteWorkOrderNoteUseCase } from './application/use-cases/delete-work-order-note.use-case';
import { GetPublicWorkOrderTrackUseCase } from './application/use-cases/get-public-work-order-track.use-case';

@Module({
  imports: [
    InventoryModule,
    InvoicesModule,
    EventsModule,
    NotificationsModule,
    QueueModule,
    AuditModule,
  ],
  controllers: [WorkOrdersController],
  providers: [
    PrismaService,
    {
      provide: 'IWorkOrderRepository',
      useClass: PrismaWorkOrderRepository,
    },
    GetWorkOrdersUseCase,
    CreateWorkOrderUseCase,
    UpdateWorkOrderStatusUseCase,
    RollbackWorkOrderUseCase,
    AddWorkOrderItemUseCase,
    UpdateWorkOrderItemQuantityUseCase,
    RemoveWorkOrderItemUseCase,
    AddWorkOrderPhotoUseCase,
    AddWorkOrderNoteUseCase,
    UpdateWorkOrderNoteUseCase,
    DeleteWorkOrderNoteUseCase,
    GetPublicWorkOrderTrackUseCase,
  ],
  exports: ['IWorkOrderRepository'],
})
export class WorkOrdersModule {}
