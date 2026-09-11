import { StockItemEntity } from './stock-item.entity';

export const INVENTORY_REPOSITORY = 'IInventoryRepository';

export interface IInventoryRepository {
  findById(tenantId: string, id: string): Promise<StockItemEntity | null>;
  findAll(
    tenantId: string,
    params?: { search?: string; category?: string },
  ): Promise<StockItemEntity[]>;
  create(item: StockItemEntity, author: string): Promise<StockItemEntity>;
  save(item: StockItemEntity): Promise<StockItemEntity>;
  delete(tenantId: string, id: string): Promise<void>;
  decrementAtomic(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity>;
  incrementAtomic(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity>;
  addStockMovement(
    tenantId: string,
    productId: string,
    movementType: string,
    quantity: number,
    refId: string | null,
    note: string,
    author: string,
  ): Promise<void>;
  getMovements(tenantId: string, productId: string): Promise<any[]>;
}
