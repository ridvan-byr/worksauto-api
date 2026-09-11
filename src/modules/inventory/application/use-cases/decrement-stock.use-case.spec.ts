import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecrementStockUseCase } from './decrement-stock.use-case';
import { IInventoryRepository } from '../../domain/inventory.repository.interface';
import { StockItemEntity } from '../../domain/stock-item.entity';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DecrementStockUseCase', () => {
  let useCase: DecrementStockUseCase;
  let mockRepo: IInventoryRepository;
  let mockEvents: EventsGateway;
  let mockNotifications: NotificationsService;

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

    mockNotifications = {
      createNotification: vi.fn(),
    } as any;

    useCase = new DecrementStockUseCase(
      mockRepo,
      mockEvents,
      mockNotifications,
    );
  });

  it('should throw NotFoundException when product does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'non-existent', 5, 'wo-1', 'Usta'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when requested quantity exceeds available stock', async () => {
    const item = new StockItemEntity({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Fren Balatası',
      oemCode: 'FB-100',
      brand: 'Bosch',
      stockQuantity: 3,
      minStockLevel: 2,
      purchasePrice: 200,
      salePrice: 350,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(item);

    await expect(
      useCase.execute('tenant-1', 'prod-1', 5, 'wo-1', 'Usta'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should decrement stock and emit stock_changed event', async () => {
    const existing = new StockItemEntity({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Fren Balatası',
      oemCode: 'FB-100',
      brand: 'Bosch',
      stockQuantity: 10,
      minStockLevel: 2,
      purchasePrice: 200,
      salePrice: 350,
    });

    const updated = new StockItemEntity({
      ...existing,
      stockQuantity: 8,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.decrementAtomic).mockResolvedValue(updated);

    const result = await useCase.execute(
      'tenant-1',
      'prod-1',
      2,
      'wo-1',
      'Usta',
    );

    expect(result.stockQuantity).toBe(8);
    expect(mockRepo.decrementAtomic).toHaveBeenCalledWith(
      'tenant-1',
      'prod-1',
      2,
      'wo-1',
      'Usta',
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'inventory:stock_changed',
      expect.objectContaining({ stockQuantity: 8 }),
    );
    expect(mockNotifications.createNotification).not.toHaveBeenCalled();
  });

  it('should trigger low stock alert and notification when remaining stock reaches threshold', async () => {
    const existing = new StockItemEntity({
      id: 'prod-1',
      tenantId: 'tenant-1',
      name: 'Fren Balatası',
      oemCode: 'FB-100',
      brand: 'Bosch',
      stockQuantity: 4,
      minStockLevel: 3,
      purchasePrice: 200,
      salePrice: 350,
    });

    const updated = new StockItemEntity({
      ...existing,
      stockQuantity: 2,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.decrementAtomic).mockResolvedValue(updated);

    await useCase.execute('tenant-1', 'prod-1', 2, 'wo-1', 'Usta');

    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'inventory:low_stock',
      expect.objectContaining({ stockQuantity: 2 }),
    );
    expect(mockNotifications.createNotification).toHaveBeenCalled();
  });
});
