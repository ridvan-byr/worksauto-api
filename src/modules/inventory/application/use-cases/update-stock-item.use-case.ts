import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IInventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { UpdateProductDto } from '../../dto/update-product.dto';

@Injectable()
export class UpdateStockItemUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<StockItemEntity> {
    const existing = await this.inventoryRepository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException('Güncellenmek istenen parça bulunamadı.');
    }

    if (dto.name !== undefined) existing.name = dto.name;
    if (dto.oemCode !== undefined) existing.oemCode = dto.oemCode;
    if (dto.barcode !== undefined) existing.barcode = dto.barcode;
    if (dto.category !== undefined) existing.category = dto.category;
    if (dto.brand !== undefined) existing.brand = dto.brand;
    if (dto.stockQuantity !== undefined)
      existing.stockQuantity = dto.stockQuantity;
    if (dto.minStockLevel !== undefined)
      existing.minStockLevel = dto.minStockLevel;
    if (dto.shelfLocation !== undefined)
      existing.shelfLocation = dto.shelfLocation;
    if (dto.purchasePrice !== undefined)
      existing.purchasePrice = dto.purchasePrice;
    if (dto.salePrice !== undefined) existing.salePrice = dto.salePrice;
    if (dto.kdvRate !== undefined) existing.kdvRate = dto.kdvRate;
    if (dto.shelfCellId !== undefined) existing.shelfCellId = dto.shelfCellId;
    if (dto.aisle !== undefined) existing.aisle = dto.aisle;
    if (dto.rack !== undefined) existing.rack = dto.rack;
    if (dto.tier !== undefined) existing.tier = dto.tier;
    if (dto.bin !== undefined) existing.bin = dto.bin;

    return this.inventoryRepository.save(existing);
  }
}
