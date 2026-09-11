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

export interface AddStockMovementInput {
  movementType: 'IN_PURCHASE' | 'OUT_WORK_ORDER' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  referenceId?: string;
  note?: string;
}

@Injectable()
export class AddStockMovementUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(
    tenantId: string,
    productId: string,
    input: AddStockMovementInput,
    author: string,
  ): Promise<StockItemEntity> {
    const item = await this.inventoryRepository.findById(tenantId, productId);
    if (!item) {
      throw new NotFoundException('Parça / Ürün bulunamadı.');
    }

    if (input.movementType === 'OUT_WORK_ORDER') {
      if (!item.canDecrement(input.quantity)) {
        throw new BadRequestException(
          `Yetersiz stok! Mevcut: ${item.stockQuantity}, Çıkış yapılmak istenen: ${input.quantity}`,
        );
      }
      item.decrement(input.quantity);
    } else if (
      input.movementType === 'IN_PURCHASE' ||
      input.movementType === 'RETURN'
    ) {
      item.increment(input.quantity);
    } else if (input.movementType === 'ADJUSTMENT') {
      item.stockQuantity = input.quantity;
    }

    const saved = await this.inventoryRepository.save(item);

    await this.inventoryRepository.addStockMovement(
      tenantId,
      productId,
      input.movementType,
      input.quantity,
      input.referenceId || null,
      input.note || `Stok Hareketi: ${input.movementType}`,
      author,
    );

    this.eventsGateway.emitToTenant(tenantId, 'inventory:stock_changed', {
      productId: saved.id,
      stockQuantity: saved.stockQuantity,
      name: saved.name,
    });

    if (saved.isLowStock()) {
      this.eventsGateway.emitToTenant(tenantId, 'inventory:low_stock', {
        id: saved.id,
        name: saved.name,
        oemCode: saved.oemCode,
        stockQuantity: saved.stockQuantity,
        minStockLevel: saved.minStockLevel,
      });

      await this.notificationsService.createNotification({
        tenantId,
        targetRoles: ['OWNER', 'SERVICE_MANAGER', 'WAREHOUSE_KEEPER'],
        type: NotificationType.WARNING,
        category: 'INVENTORY',
        title: 'Kritik Stok Uyarısı',
        message: `"${saved.name}" (${saved.oemCode}) kritik stok seviyesine indi! Kalan: ${saved.stockQuantity}, Min: ${saved.minStockLevel}`,
        link: '/inventory',
        metadata: {
          productId: saved.id,
          oemCode: saved.oemCode,
          stockQuantity: saved.stockQuantity,
          minStockLevel: saved.minStockLevel,
        },
      });
    }

    return saved;
  }
}
