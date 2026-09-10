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
