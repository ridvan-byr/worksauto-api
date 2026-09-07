import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddStockMovementUseCase } from './add-stock-movement.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AddStockMovementUseCase', () => {
  let useCase: AddStockMovementUseCase;
  let mockRepo: IInventoryRepository;
  let mockEvents: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      save: vi.fn(),
      addStockMovement: vi.fn().mockResolvedValue({}),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    useCase = new AddStockMovementUseCase(mockRepo, mockEvents, mockNotifications);
  });

  it('should throw NotFoundException if item does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'p-1', { movementType: 'IN_PURCHASE', quantity: 5 }, 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if stock is insufficient for OUT_WORK_ORDER', async () => {
    const item = new StockItemEntity({
      id: 'p-1',
      tenantId: 't-1',
      name: 'Yağ Filtresi',
      oemCode: 'YF-01',
      brand: 'Mann',
      stockQuantity: 2,
      purchasePrice: 50,
      salePrice: 100,
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(item);

    await expect(
      useCase.execute('t-1', 'p-1', { movementType: 'OUT_WORK_ORDER', quantity: 5 }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should increase stock on IN_PURCHASE and emit events', async () => {
    const item = new StockItemEntity({
      id: 'p-1',
      tenantId: 't-1',
      name: 'Yağ Filtresi',
      oemCode: 'YF-01',
      brand: 'Mann',
      stockQuantity: 2,
      minStockLevel: 5,
      purchasePrice: 50,
      salePrice: 100,
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(item);
    vi.mocked(mockRepo.save).mockImplementation(async (entity) => entity);

    const result = await useCase.execute(
      't-1',
      'p-1',
      { movementType: 'IN_PURCHASE', quantity: 10 },
      'user-1',
    );

    expect(result.stockQuantity).toBe(12);
    expect(mockRepo.addStockMovement).toHaveBeenCalled();
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      't-1',
      'inventory:stock_changed',
      expect.anything(),
    );
  });
});
