export const SHELF_REPOSITORY = 'IShelfRepository';

export interface CreateShelfInput {
  name: string;
  code: string;
  zone?: string | null;
  rows: number;
  columns: number;
  description?: string | null;
}

export interface IShelfRepository {
  findByCode(tenantId: string, code: string): Promise<any | null>;
  createShelfWithCells(tenantId: string, input: CreateShelfInput): Promise<any>;
  findAllWithStats(tenantId: string): Promise<any[]>;
  findByIdWithMatrix(tenantId: string, shelfId: string): Promise<any | null>;
  findProduct(tenantId: string, productId: string): Promise<any | null>;
  findCell(shelfCellId: string): Promise<any | null>;
  updateProductLocation(productId: string, data: any): Promise<any>;
  updateManyProductLocations(productIds: string[], data: any): Promise<number>;
  findFirstCellOfShelf(shelfId: string): Promise<any | null>;
  findShelfById(tenantId: string, shelfId: string): Promise<any | null>;
  deleteShelf(shelfId: string): Promise<void>;
}

