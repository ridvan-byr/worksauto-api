import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  CreateShelfInput,
  IShelfRepository,
} from '../domain/shelf.repository.interface';

@Injectable()
export class PrismaShelfRepository implements IShelfRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(tenantId: string, code: string): Promise<any | null> {
    return this.prisma.warehouseShelf.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
  }

  async createShelfWithCells(
    tenantId: string,
    input: CreateShelfInput,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const shelf = await tx.warehouseShelf.create({
        data: {
          tenantId,
          name: input.name,
          code: input.code,
          zone: input.zone || null,
          rows: input.rows,
          columns: input.columns,
          description: input.description || null,
        },
      });

      const cellsToCreate: Array<{
        shelfId: string;
        cellCode: string;
        rowNumber: number;
        colNumber: number;
      }> = [];

      for (let r = 1; r <= input.rows; r++) {
        for (let c = 1; c <= input.columns; c++) {
          cellsToCreate.push({
            shelfId: shelf.id,
            cellCode: `${input.code}-K${r}-G${c}`,
            rowNumber: r,
            colNumber: c,
          });
        }
      }

      await tx.shelfCell.createMany({
        data: cellsToCreate,
      });

      return {
        ...shelf,
        totalCells: cellsToCreate.length,
      };
    });
  }

  async findAllWithStats(tenantId: string): Promise<any[]> {
    const shelves = await this.prisma.warehouseShelf.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { cells: true },
        },
        cells: {
          select: {
            id: true,
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return shelves.map((s) => {
      const occupiedCellsCount = s.cells.filter(
        (c) => c._count.products > 0,
      ).length;
      const totalProductsCount = s.cells.reduce(
        (acc, c) => acc + c._count.products,
        0,
      );

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        zone: s.zone,
        rows: s.rows,
        columns: s.columns,
        description: s.description,
        createdAt: s.createdAt,
        totalCells: s._count.cells,
        occupiedCells: occupiedCellsCount,
        totalProducts: totalProductsCount,
        occupancyRate:
          s._count.cells > 0
            ? Math.round((occupiedCellsCount / s._count.cells) * 100)
            : 0,
      };
    });
  }

  async findByIdWithMatrix(
    tenantId: string,
    shelfId: string,
  ): Promise<any | null> {
    return this.prisma.warehouseShelf.findFirst({
      where: { id: shelfId, tenantId },
      include: {
        cells: {
          orderBy: [{ rowNumber: 'asc' }, { colNumber: 'asc' }],
          include: {
            products: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                oemCode: true,
                brand: true,
                category: true,
                stockQuantity: true,
                minStockLevel: true,
                salePrice: true,
                shelfLocation: true,
              },
            },
          },
        },
      },
    });
  }

  async findProduct(tenantId: string, productId: string): Promise<any | null> {
    return this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });
  }

  async findCell(shelfCellId: string): Promise<any | null> {
    return this.prisma.shelfCell.findFirst({
      where: { id: shelfCellId },
      include: { shelf: true },
    });
  }

  async updateProductLocation(productId: string, data: any): Promise<any> {
    return this.prisma.product.update({
      where: { id: productId },
      data,
    });
  }

  async updateManyProductLocations(
    productIds: string[],
    data: any,
  ): Promise<number> {
    const res = await this.prisma.product.updateMany({
      where: { id: { in: productIds } },
      data,
    });
    return res.count;
  }

  async findFirstCellOfShelf(shelfId: string): Promise<any | null> {
    return this.prisma.shelfCell.findFirst({
      where: { shelfId },
      orderBy: [{ rowNumber: 'asc' }, { colNumber: 'asc' }],
      include: { shelf: true },
    });
  }

  async findShelfById(tenantId: string, shelfId: string): Promise<any | null> {
    return this.prisma.warehouseShelf.findFirst({
      where: { id: shelfId, tenantId },
      include: {
        cells: {
          select: {
            id: true,
            _count: { select: { products: { where: { deletedAt: null } } } },
          },
        },
      },
    });
  }

  async deleteShelf(shelfId: string): Promise<void> {
    await this.prisma.warehouseShelf.delete({
      where: { id: shelfId },
    });
  }
}
