import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CreateShelfDto } from '../../dto/create-shelf.dto';

@Injectable()
export class ManageShelvesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async createShelf(tenantId: string, dto: CreateShelfDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.warehouseShelf.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });

    if (existing) {
      throw new BadRequestException(`'${code}' kodlu raf ünitesi zaten mevcut.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const shelf = await tx.warehouseShelf.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          code,
          zone: dto.zone?.trim() || null,
          rows: dto.rows,
          columns: dto.columns,
          description: dto.description?.trim() || null,
        },
      });

      // Otomatik Hücre Üretimi (Kat: Row, Göz: Column)
      const cellsToCreate: Array<{
        shelfId: string;
        cellCode: string;
        rowNumber: number;
        colNumber: number;
      }> = [];

      for (let r = 1; r <= dto.rows; r++) {
        for (let c = 1; c <= dto.columns; c++) {
          cellsToCreate.push({
            shelfId: shelf.id,
            cellCode: `${code}-K${r}-G${c}`, // Örn: RAF-A01-K1-G1 (Kat 1, Göz 1)
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

  async getShelves(tenantId: string) {
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
      const occupiedCellsCount = s.cells.filter((c) => c._count.products > 0).length;
      const totalProductsCount = s.cells.reduce((acc, c) => acc + c._count.products, 0);

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
        occupancyRate: s._count.cells > 0 ? Math.round((occupiedCellsCount / s._count.cells) * 100) : 0,
      };
    });
  }

  async getShelfWithMatrix(tenantId: string, shelfId: string) {
    const shelf = await this.prisma.warehouseShelf.findFirst({
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

    if (!shelf) {
      throw new NotFoundException('Raf ünitesi bulunamadı.');
    }

    return shelf;
  }

  async assignProductToCell(tenantId: string, productId: string, shelfCellId?: string | null) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    if (!shelfCellId) {
      // Hücreden ayır ve konum alanlarını temizle
      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: {
          shelfCellId: null,
          shelfId: null,
          shelfLocation: null,
          aisle: null,
          rack: null,
          tier: null,
          bin: null,
        },
      });
      return { success: true, product: updated };
    }

    // Hücreyi doğrula
    const cell = await this.prisma.shelfCell.findFirst({
      where: { id: shelfCellId },
      include: { shelf: true },
    });

    if (!cell || cell.shelf.tenantId !== tenantId) {
      throw new BadRequestException('Seçilen raf hücresi bulunamadı veya bu işletmeye ait değil.');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        shelfCellId: cell.id,
        shelfId: cell.shelf.id,
        shelfLocation: cell.cellCode,
        aisle: cell.shelf.zone || cell.shelf.name,
        rack: cell.shelf.code,
        tier: `Kat ${cell.rowNumber}`,
        bin: `Göz ${cell.colNumber}`,
      },
    });

    return { success: true, product: updated, cellCode: cell.cellCode };
  }

  async deleteShelf(tenantId: string, shelfId: string) {
    const shelf = await this.prisma.warehouseShelf.findFirst({
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

    if (!shelf) {
      throw new NotFoundException('Raf bulunamadı.');
    }

    const totalAssignedProducts = shelf.cells.reduce((acc, c) => acc + c._count.products, 0);
    if (totalAssignedProducts > 0) {
      throw new BadRequestException(
        `Bu rafta halihazırda ${totalAssignedProducts} adet atanmış parça var. Önce parçaların raf atamasını kaldırınız.`,
      );
    }

    await this.prisma.warehouseShelf.delete({
      where: { id: shelfId },
    });

    return { success: true, message: 'Raf ünitesi silindi.' };
  }
}
