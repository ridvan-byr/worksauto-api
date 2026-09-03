import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ProductCategory, StockMovementType } from '@prisma/client';

export interface CreateProductDto {
  name: string;
  oemCode: string;
  barcode?: string;
  category?: ProductCategory;
  brand: string;
  stockQuantity: number;
  minStockLevel?: number;
  shelfLocation: string;
  purchasePrice: number;
  salePrice: number;
  kdvRate?: number;
  aisle?: string;
  rack?: string;
  tier?: string;
  bin?: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string, category?: ProductCategory) {
    return this.prisma.product.findMany({
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
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!product) throw new NotFoundException('Parça / Ürün bulunamadı.');
    return product;
  }

  async create(tenantId: string, dto: CreateProductDto, createdBy: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          name: dto.name,
          oemCode: dto.oemCode.toUpperCase().trim(),
          barcode: dto.barcode,
          category: dto.category || ProductCategory.GENERAL,
          brand: dto.brand,
          stockQuantity: dto.stockQuantity,
          minStockLevel: dto.minStockLevel || 5,
          shelfLocation: dto.shelfLocation,
          purchasePrice: dto.purchasePrice,
          salePrice: dto.salePrice,
          kdvRate: dto.kdvRate || 20,
          aisle: dto.aisle,
          rack: dto.rack,
          tier: dto.tier,
          bin: dto.bin,
        },
      });

      if (dto.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: product.id,
            movementType: StockMovementType.IN_PURCHASE,
            quantity: dto.stockQuantity,
            note: 'İlk stok girişi (Açılış bakiyesi)',
            createdBy,
          },
        });
      }

      return product;
    });
  }

  /**
   * ATOMIC STOCK DECREMENT
   * Prevents negative stock under extreme concurrency.
   */
  async decrementStockAtomic(tenantId: string, productId: string, quantity: number, refId: string, author: string) {
    const updated = await this.prisma.$executeRawUnsafe(
      `UPDATE products 
       SET stock_quantity = stock_quantity - $1 
       WHERE id = $2::uuid AND tenant_id = $3::uuid AND stock_quantity >= $1`,
      quantity,
      productId,
      tenantId,
    );

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

    return true;
  }

  async incrementStock(tenantId: string, productId: string, quantity: number, refId: string, author: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
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

      return product;
    });
  }
}
