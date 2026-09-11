import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetStockItemsUseCase } from './get-stock-items.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { NotFoundException } from '@nestjs/common';

describe('GetStockItemsUseCase', () => {
  let useCase: GetStockItemsUseCase;
  let mockRepo: IInventoryRepository;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      getMovements: vi.fn(),
    } as any;

    useCase = new GetStockItemsUseCase(mockRepo);
  });

  it('should return all stock items for tenant', async () => {
    const list = [
      new StockItemEntity({
        id: 'prod-1',
        tenantId: 't-1',
        name: 'Hava Filtresi',
        oemCode: 'HF-01',
        brand: 'Bosch',
        stockQuantity: 15,
        purchasePrice: 40,
        salePrice: 80,
      }),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValue(list);

    const result = await useCase.execute('t-1', { search: 'Hava' });
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', { search: 'Hava' });
  });

  it('should throw NotFoundException if stock item not found by id', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.getById('t-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
