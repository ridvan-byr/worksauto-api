import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IInventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class DecrementStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity> {
    const item = await this.inventoryRepository.findById(tenantId, productId);
    if (!item) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    if (!item.canDecrement(quantity)) {
      throw new BadRequestException(
        `Yetersiz stok! Mevcut stok: ${item.stockQuantity}, istenen: ${quantity}`,
      );
    }

    const updatedItem = await this.inventoryRepository.decrementAtomic(
      tenantId,
      productId,
      quantity,
      refId,
      author,
    );

    this.eventsGateway.emitToTenant(tenantId, 'inventory:stock_changed', {
      productId: updatedItem.id,
      stockQuantity: updatedItem.stockQuantity,
      name: updatedItem.name,
    });

    if (updatedItem.isLowStock()) {
      this.eventsGateway.emitToTenant(tenantId, 'inventory:low_stock', {
        id: updatedItem.id,
        name: updatedItem.name,
        oemCode: updatedItem.oemCode,
        stockQuantity: updatedItem.stockQuantity,
        minStockLevel: updatedItem.minStockLevel,
      });

      await this.notificationsService.createNotification({
        tenantId,
        targetRoles: ['OWNER', 'SERVICE_MANAGER', 'WAREHOUSE_KEEPER'],
        type: NotificationType.WARNING,
        category: 'INVENTORY',
        title: 'Kritik Stok Uyarısı',
        message: `"${updatedItem.name}" (${updatedItem.oemCode}) kritik stok seviyesine indi! Kalan: ${updatedItem.stockQuantity}, Min: ${updatedItem.minStockLevel}`,
        link: '/inventory',
        metadata: {
          productId: updatedItem.id,
          oemCode: updatedItem.oemCode,
          stockQuantity: updatedItem.stockQuantity,
          minStockLevel: updatedItem.minStockLevel,
        },
      });
    }

    return updatedItem;
  }
}
