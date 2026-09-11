import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IInventoryRepository, INVENTORY_REPOSITORY } from '../../domain/inventory.repository.interface';

@Injectable()
export class DeleteStockItemUseCase {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.inventoryRepository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException('Silinmek istenen parça bulunamadı.');
    }

    await this.inventoryRepository.delete(tenantId, id);
    return { success: true, message: `'${existing.name}' parçası başarıyla silindi.` };
  }
}
