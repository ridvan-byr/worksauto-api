import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IInventoryRepository, INVENTORY_REPOSITORY } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { EventsGateway } from '../../../events/events.gateway';

@Injectable()
export class IncrementStockUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity> {
    if (quantity <= 0) {
      throw new BadRequestException('Eklenecek miktar 0 dan büyük olmalıdır.');
    }

    const item = await this.inventoryRepository.findById(tenantId, productId);
    if (!item) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    const updatedItem = await this.inventoryRepository.incrementAtomic(
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

    return updatedItem;
  }
}
