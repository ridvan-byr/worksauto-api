import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { IInventoryRepository } from '../domain/inventory.repository.interface';
import { StockItemEntity } from '../domain/stock-item.entity';
import { ProductCategory, StockMovementType } from '@prisma/client';

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): StockItemEntity {
    return new StockItemEntity({
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      oemCode: data.oemCode,
      barcode: data.barcode ?? undefined,
      category: data.category,
      brand: data.brand,
      stockQuantity: data.stockQuantity,
      minStockLevel: data.minStockLevel,
      shelfLocation: data.shelfLocation ?? undefined,
      purchasePrice: Number(data.purchasePrice),
      salePrice: Number(data.salePrice),
      kdvRate: data.kdvRate,
      aisle: data.aisle ?? undefined,
      rack: data.rack ?? undefined,
      tier: data.tier ?? undefined,
      bin: data.bin ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findById(tenantId: string, id: string): Promise<StockItemEntity | null> {
    const data = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return data ? this.mapToEntity(data) : null;
  }

  async findAll(tenantId: string, params?: { search?: string; category?: string }): Promise<StockItemEntity[]> {
    const category = params?.category as ProductCategory | undefined;
    const search = params?.search;

    const data = await this.prisma.product.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { oemCode: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search } },
                { brand: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });

    return data.map((d) => this.mapToEntity(d));
  }

  async create(item: StockItemEntity, author: string): Promise<StockItemEntity> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId: item.tenantId,
          name: item.name,
          oemCode: item.oemCode,
          barcode: item.barcode,
          category: (item.category as ProductCategory) || ProductCategory.GENERAL,
          brand: item.brand,
          stockQuantity: item.stockQuantity,
          minStockLevel: item.minStockLevel,
          shelfLocation: item.shelfLocation,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          kdvRate: item.kdvRate,
          aisle: item.aisle,
          rack: item.rack,
          tier: item.tier,
          bin: item.bin,
        },
      });

      if (item.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            tenantId: item.tenantId,
            productId: created.id,
            movementType: StockMovementType.IN_PURCHASE,
            quantity: item.stockQuantity,
            note: 'İlk stok girişi (Açılış bakiyesi)',
            createdBy: author,
          },
        });
      }

      return this.mapToEntity(created);
    });
  }

  async save(item: StockItemEntity): Promise<StockItemEntity> {
    const updated = await this.prisma.product.update({
      where: { id: item.id },
      data: {
        name: item.name,
        oemCode: item.oemCode,
        barcode: item.barcode,
        category: item.category as ProductCategory,
        brand: item.brand,
        stockQuantity: item.stockQuantity,
        minStockLevel: item.minStockLevel,
        shelfLocation: item.shelfLocation,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        kdvRate: item.kdvRate,
        aisle: item.aisle,
        rack: item.rack,
        tier: item.tier,
        bin: item.bin,
      },
    });
    return this.mapToEntity(updated);
  }

  async decrementAtomic(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity> {
    const updated = await this.prisma.$executeRaw`
      UPDATE products 
      SET stock_quantity = stock_quantity - ${quantity} 
      WHERE id = ${productId}::uuid AND tenant_id = ${tenantId}::uuid AND stock_quantity >= ${quantity}
    `;

    if (updated === 0) {
      throw new BadRequestException('Yetersiz stok! Talep edilen miktar mevcut stoktan fazladır.');
    }

    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        productId,
        movementType: StockMovementType.OUT_WORK_ORDER,
        quantity,
        referenceId: refId,
        note: `İş Emri (#${refId}) kapsamında stoktan düşüldü.`,
        createdBy: author,
      },
    });

    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    return this.mapToEntity(product);
  }

  async incrementAtomic(
    tenantId: string,
    productId: string,
    quantity: number,
    refId: string,
    author: string,
  ): Promise<StockItemEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: quantity } },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId,
          movementType: StockMovementType.RETURN,
          quantity,
          referenceId: refId,
          note: `İptal / İade işlemi: #${refId}`,
          createdBy: author,
        },
      });

      return this.mapToEntity(updated);
    });
  }

  async addStockMovement(
    tenantId: string,
    productId: string,
    movementType: string,
    quantity: number,
    refId: string | null,
    note: string,
    author: string,
  ): Promise<void> {
    await this.prisma.stockMovement.create({
      data: {
        tenantId,
        productId,
        movementType: movementType as StockMovementType,
        quantity,
        referenceId: refId,
        note,
        createdBy: author,
      },
    });
  }

  async getMovements(tenantId: string, productId: string): Promise<any[]> {
    return this.prisma.stockMovement.findMany({
      where: { tenantId, productId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
