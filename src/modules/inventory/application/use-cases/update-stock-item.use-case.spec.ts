import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateStockItemUseCase } from './update-stock-item.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { NotFoundException } from '@nestjs/common';

describe('UpdateStockItemUseCase', () => {
  let useCase: UpdateStockItemUseCase;
  let mockRepo: IInventoryRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      save: vi.fn(),
    } as any;

    useCase = new UpdateStockItemUseCase(mockRepo);
  });

  it('should throw NotFoundException if item does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'prod-not-found', { name: 'Yeni Ad' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should update item fields and save', async () => {
    const existing = new StockItemEntity({
      id: 'prod-1',
      tenantId: 't-1',
      name: 'Polen Filtresi',
      oemCode: 'PF-01',
      brand: 'Bosch',
      stockQuantity: 4,
      purchasePrice: 80,
      salePrice: 150,
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.save).mockImplementation(async (item) => item);

    const result = await useCase.execute('t-1', 'prod-1', {
      name: 'Karbonlu Polen Filtresi',
      salePrice: 220,
    });

    expect(result.name).toBe('Karbonlu Polen Filtresi');
    expect(result.salePrice).toBe(220);
    expect(mockRepo.save).toHaveBeenCalledWith(existing);
  });
});
