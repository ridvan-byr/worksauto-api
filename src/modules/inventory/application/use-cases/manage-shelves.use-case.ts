import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { SHELF_REPOSITORY, IShelfRepository } from '../../domain/shelf.repository.interface';
import { CreateShelfDto } from '../../dto/create-shelf.dto';

@Injectable()
export class ManageShelvesUseCase {
  constructor(
    @Inject(SHELF_REPOSITORY)
    private readonly shelfRepository: IShelfRepository,
  ) {}

  async createShelf(tenantId: string, dto: CreateShelfDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.shelfRepository.findByCode(tenantId, code);

    if (existing) {
      throw new BadRequestException(`'${code}' kodlu raf ünitesi zaten mevcut.`);
    }

    return this.shelfRepository.createShelfWithCells(tenantId, {
      name: dto.name.trim(),
      code,
      zone: dto.zone?.trim() || null,
      rows: dto.rows,
      columns: dto.columns,
      description: dto.description?.trim() || null,
    });
  }

  async getShelves(tenantId: string) {
    return this.shelfRepository.findAllWithStats(tenantId);
  }

  async getShelfWithMatrix(tenantId: string, shelfId: string) {
    const shelf = await this.shelfRepository.findByIdWithMatrix(tenantId, shelfId);

    if (!shelf) {
      throw new NotFoundException('Raf ünitesi bulunamadı.');
    }

    return shelf;
  }

  async assignProductToCell(tenantId: string, productId: string, shelfCellId?: string | null) {
    const product = await this.shelfRepository.findProduct(tenantId, productId);

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    if (!shelfCellId) {
      const updated = await this.shelfRepository.updateProductLocation(productId, {
        shelfCellId: null,
        shelfId: null,
        shelfLocation: '',
        aisle: null,
        rack: null,
        tier: null,
        bin: null,
      });
      return { success: true, product: updated };
    }

    const cell = await this.shelfRepository.findCell(shelfCellId);

    if (!cell || cell.shelf.tenantId !== tenantId) {
      throw new BadRequestException('Seçilen raf hücresi bulunamadı veya bu işletmeye ait değil.');
    }

    const updated = await this.shelfRepository.updateProductLocation(productId, {
      shelfCellId: cell.id,
      shelfId: cell.shelf.id,
      shelfLocation: cell.cellCode,
      aisle: cell.shelf.zone || cell.shelf.name,
      rack: cell.shelf.code,
      tier: `Kat ${cell.rowNumber}`,
      bin: `Göz ${cell.colNumber}`,
    });

    return { success: true, product: updated, cellCode: cell.cellCode };
  }

  async bulkAssignProductCell(
    tenantId: string,
    productIds: string[],
    shelfCellId?: string | null,
    targetShelfId?: string | null,
  ) {
    if (!productIds || productIds.length === 0) {
      return { success: true, count: 0, message: 'İşlem yapılacak parça bulunamadı.' };
    }

    if (!shelfCellId && !targetShelfId) {
      const count = await this.shelfRepository.updateManyProductLocations(productIds, {
        shelfCellId: null,
        shelfId: null,
        shelfLocation: 'Depo',
        aisle: null,
        rack: null,
        tier: null,
        bin: null,
      });
      return { success: true, count, message: `${count} parça raflardan serbest alana çıkarıldı.` };
    }

    if (shelfCellId) {
      const cell = await this.shelfRepository.findCell(shelfCellId);
      if (!cell) {
        throw new NotFoundException('Hedef raf hücresi bulunamadı.');
      }
      const count = await this.shelfRepository.updateManyProductLocations(productIds, {
        shelfCellId: cell.id,
        shelfId: cell.shelf.id,
        shelfLocation: cell.cellCode,
        aisle: cell.shelf.zone || cell.shelf.name,
        rack: cell.shelf.code,
        tier: `Kat ${cell.rowNumber}`,
        bin: `Göz ${cell.colNumber}`,
      });
      return {
        success: true,
        count,
        cellCode: cell.cellCode,
        shelfCode: cell.shelf.code,
        message: `${count} adet parça toplu olarak ${cell.cellCode} hücresine taşındı.`,
      };
    }

    if (targetShelfId) {
      const shelf = await this.shelfRepository.findShelfById(tenantId, targetShelfId);
      if (!shelf) {
        throw new NotFoundException('Hedef raf bulunamadı.');
      }
      const firstCell = await this.shelfRepository.findFirstCellOfShelf(targetShelfId);
      if (firstCell) {
        const count = await this.shelfRepository.updateManyProductLocations(productIds, {
          shelfCellId: firstCell.id,
          shelfId: firstCell.shelf.id,
          shelfLocation: firstCell.cellCode,
          aisle: firstCell.shelf.zone || firstCell.shelf.name,
          rack: firstCell.shelf.code,
          tier: `Kat ${firstCell.rowNumber}`,
          bin: `Göz ${firstCell.colNumber}`,
        });
        return {
          success: true,
          count,
          cellCode: firstCell.cellCode,
          shelfCode: firstCell.shelf.code,
          message: `${count} adet parça toplu olarak ${firstCell.shelf.code} rafına taşındı.`,
        };
      }
    }

    return { success: true, count: 0 };
  }

  async deleteShelf(tenantId: string, shelfId: string) {
    const shelf = await this.shelfRepository.findShelfById(tenantId, shelfId);

    if (!shelf) {
      throw new NotFoundException('Raf bulunamadı.');
    }

    const totalAssignedProducts = shelf.cells.reduce((acc: number, c: any) => acc + c._count.products, 0);
    if (totalAssignedProducts > 0) {
      throw new BadRequestException(
        `Bu rafta halihazırda ${totalAssignedProducts} adet atanmış parça var. Önce parçaların raf atamasını kaldırınız.`,
      );
    }

    await this.shelfRepository.deleteShelf(shelfId);

    return { success: true, message: 'Raf ünitesi silindi.' };
  }
}
