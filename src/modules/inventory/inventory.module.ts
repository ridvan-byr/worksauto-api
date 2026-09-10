import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { INVENTORY_REPOSITORY } from './domain/inventory.repository.interface';
import { PrismaInventoryRepository } from './infrastructure/prisma-inventory.repository';
import { SHELF_REPOSITORY } from './domain/shelf.repository.interface';
import { PrismaShelfRepository } from './infrastructure/prisma-shelf.repository';

import { InventoryController } from './presentation/inventory.controller';
import { GetStockItemsUseCase } from './application/use-cases/get-stock-items.use-case';
import { CreateStockItemUseCase } from './application/use-cases/create-stock-item.use-case';
import { DecrementStockUseCase } from './application/use-cases/decrement-stock.use-case';
import { IncrementStockUseCase } from './application/use-cases/increment-stock.use-case';
import { AddStockMovementUseCase } from './application/use-cases/add-stock-movement.use-case';
import { ManageShelvesUseCase } from './application/use-cases/manage-shelves.use-case';

@Module({
  imports: [EventsModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [
    PrismaService,
    {
      provide: INVENTORY_REPOSITORY,
      useClass: PrismaInventoryRepository,
    },
    {
      provide: SHELF_REPOSITORY,
      useClass: PrismaShelfRepository,
    },
    GetStockItemsUseCase,
    CreateStockItemUseCase,
    DecrementStockUseCase,
    IncrementStockUseCase,
    AddStockMovementUseCase,
    ManageShelvesUseCase,
  ],
  exports: [
    INVENTORY_REPOSITORY,
    SHELF_REPOSITORY,
    DecrementStockUseCase,
    IncrementStockUseCase,
    GetStockItemsUseCase,
    CreateStockItemUseCase,
    AddStockMovementUseCase,
    ManageShelvesUseCase,
  ],
})
export class InventoryModule {}
