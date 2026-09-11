import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncrementStockUseCase } from './increment-stock.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { EventsGateway } from '../../../events/events.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IncrementStockUseCase', () => {
  let useCase: IncrementStockUseCase;
  let mockRepo: IInventoryRepository;
  let mockEvents: EventsGateway;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      decrementAtomic: vi.fn(),
      incrementAtomic: vi.fn(),
      addStockMovement: vi.fn(),
      getMovements: vi.fn(),
      delete: vi.fn(),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    } as any;

    useCase = new IncrementStockUseCase(mockRepo, mockEvents);
  });

  it('should throw BadRequestException when quantity <= 0', async () => {
    await expect(
      useCase.execute('tenant-1', 'prod-1', 0, 'ref-1', 'author'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when product does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'prod-1', 5, 'ref-1', 'author'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should increment stock and emit stock_changed event', async () => {
    const existing = new StockItemEntity({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Motor Yağı',
      oemCode: 'OIL-5W30',
      brand: 'Castrol',
      stockQuantity: 10,
      purchasePrice: 500,
      salePrice: 850,
    });

    const updated = new StockItemEntity({
      ...existing,
      stockQuantity: 15,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.incrementAtomic).mockResolvedValue(updated);

    const result = await useCase.execute(
      'tenant-1',
      'prod-1',
      5,
      'ref-1',
      'author',
    );

    expect(result.stockQuantity).toBe(15);
    expect(mockRepo.incrementAtomic).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      5,
      'ref-1',
      'author',
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'inventory:stock_changed',
      expect.objectContaining({ stockQuantity: 15 }),
    );
  });
});
