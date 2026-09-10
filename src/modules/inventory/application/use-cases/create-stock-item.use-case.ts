import { Injectable, Inject } from '@nestjs/common';
import { IInventoryRepository, INVENTORY_REPOSITORY } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';

export interface CreateStockItemInput {
  name: string;
  oemCode: string;
  barcode?: string;
  category?: string;
  brand: string;
  stockQuantity: number;
  minStockLevel?: number;
  shelfLocation?: string;
  purchasePrice: number;
  salePrice: number;
  kdvRate?: number;
  aisle?: string;
  rack?: string;
  tier?: string;
  bin?: string;
  shelfCellId?: string;
}

@Injectable()
export class CreateStockItemUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateStockItemInput,
    author: string,
  ): Promise<StockItemEntity> {
    const item = new StockItemEntity({
      tenantId,
      name: dto.name,
      oemCode: dto.oemCode,
      barcode: dto.barcode,
      category: dto.category,
      brand: dto.brand,
      stockQuantity: dto.stockQuantity,
      minStockLevel: dto.minStockLevel ?? 5,
      shelfLocation: dto.shelfLocation,
      purchasePrice: dto.purchasePrice,
      salePrice: dto.salePrice,
      kdvRate: dto.kdvRate ?? 20,
      aisle: dto.aisle,
      rack: dto.rack,
      tier: dto.tier,
      bin: dto.bin,
      shelfCellId: dto.shelfCellId,
    });

    return this.inventoryRepository.create(item, author);
  }
}
