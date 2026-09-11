import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateStockItemUseCase } from './create-stock-item.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';

describe('CreateStockItemUseCase', () => {
  let useCase: CreateStockItemUseCase;
  let mockRepo: IInventoryRepository;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
    } as any;

    useCase = new CreateStockItemUseCase(mockRepo);
  });

  it('should create a stock item via repository', async () => {
    const created = new StockItemEntity({
      id: 'prod-1',
      tenantId: 't-1',
      name: 'Fren Balatası',
      oemCode: 'FB-01',
      brand: 'Bosch',
      stockQuantity: 10,
      minStockLevel: 5,
      purchasePrice: 100,
      salePrice: 200,
      kdvRate: 20,
    });
    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute(
      't-1',
      {
        name: 'Fren Balatası',
        oemCode: 'FB-01',
        brand: 'Bosch',
        stockQuantity: 10,
        purchasePrice: 100,
        salePrice: 200,
      },
      'admin-user',
    );

    expect(result.id).toBe('prod-1');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.any(StockItemEntity),
      'admin-user',
    );
  });
});
