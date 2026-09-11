import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';

@Injectable()
export class GetStockItemsUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(
    tenantId: string,
    params?: { search?: string; category?: string },
  ): Promise<StockItemEntity[]> {
    return this.inventoryRepository.findAll(tenantId, params);
  }

  async getById(tenantId: string, id: string): Promise<StockItemEntity> {
    const item = await this.inventoryRepository.findById(tenantId, id);
    if (!item) {
      throw new NotFoundException('Parça / Ürün bulunamadı.');
    }
    return item;
  }

  async getMovements(tenantId: string, productId: string): Promise<any[]> {
    await this.getById(tenantId, productId);
    return this.inventoryRepository.getMovements(tenantId, productId);
  }
}
