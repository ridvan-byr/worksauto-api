import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteStockItemUseCase } from './delete-stock-item.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { NotFoundException } from '@nestjs/common';

describe('DeleteStockItemUseCase', () => {
  let useCase: DeleteStockItemUseCase;
  let mockRepo: IInventoryRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      delete: vi.fn(),
    } as any;

    useCase = new DeleteStockItemUseCase(mockRepo);
  });

  it('should throw NotFoundException if item does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'prod-not-found')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should delete existing item and return success message', async () => {
    const existing = new StockItemEntity({
      id: 'prod-1',
      tenantId: 't-1',
      name: 'Hava Filtresi',
      oemCode: 'HF-10',
      brand: 'Mann',
      stockQuantity: 5,
      purchasePrice: 100,
      salePrice: 150,
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.delete).mockResolvedValue(undefined);

    const result = await useCase.execute('t-1', 'prod-1');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Hava Filtresi');
    expect(mockRepo.delete).toHaveBeenCalledWith('t-1', 'prod-1');
  });
});
