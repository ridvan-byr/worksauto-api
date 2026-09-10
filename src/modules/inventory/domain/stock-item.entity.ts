export interface StockItemProps {
  id?: string;
  tenantId: string;
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
  shelfId?: string;
  shelfCellId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StockItemEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public name: string;
  public oemCode: string;
  public barcode?: string;
  public category?: string;
  public brand: string;
  public stockQuantity: number;
  public minStockLevel: number;
  public shelfLocation?: string;
  public purchasePrice: number;
  public salePrice: number;
  public kdvRate: number;
  public aisle?: string;
  public rack?: string;
  public tier?: string;
  public bin?: string;
  public shelfId?: string;
  public shelfCellId?: string;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: StockItemProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.oemCode = props.oemCode.toUpperCase().trim();
    this.barcode = props.barcode;
    this.category = props.category || 'GENERAL';
    this.brand = props.brand;
    this.stockQuantity = props.stockQuantity;
    this.minStockLevel = props.minStockLevel ?? 5;
    this.shelfLocation = props.shelfLocation;
    this.purchasePrice = props.purchasePrice;
    this.salePrice = props.salePrice;
    this.kdvRate = props.kdvRate ?? 20;
    this.aisle = props.aisle;
    this.rack = props.rack;
    this.tier = props.tier;
    this.bin = props.bin;
    this.shelfId = props.shelfId;
    this.shelfCellId = props.shelfCellId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public canDecrement(qty: number): boolean {
    if (qty <= 0) return false;
    return this.stockQuantity >= qty;
  }

  public decrement(qty: number): void {
    if (qty <= 0) {
      throw new Error('Düşülecek miktar 0 dan büyük olmalıdır.');
    }
    if (!this.canDecrement(qty)) {
      throw new Error(`Yetersiz stok! Mevcut stok: ${this.stockQuantity}, istenen: ${qty}`);
    }
    this.stockQuantity -= qty;
  }

  public increment(qty: number): void {
    if (qty <= 0) {
      throw new Error('Eklenecek miktar 0 dan büyük olmalıdır.');
    }
    this.stockQuantity += qty;
  }

  public isLowStock(): boolean {
    return this.stockQuantity <= this.minStockLevel;
  }
}
