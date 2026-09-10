import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateWorkOrderItemQuantityUseCase } from './update-work-order-item-quantity.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('UpdateWorkOrderItemQuantityUseCase', () => {
  let useCase: UpdateWorkOrderItemQuantityUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: any;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      updateItem: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new UpdateWorkOrderItemQuantityUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if work order not found', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', { quantity: 3 }, 'Ali')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if work order is completed or cancelled', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({ id: 'wo-1', status: WorkOrderStatusEnum.COMPLETED });

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', { quantity: 3 }, 'Ali')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw NotFoundException if item is not found in work order', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
      items: [],
    });

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', { quantity: 3 }, 'Ali')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update item quantity successfully', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
      items: [{ id: 'it-1', name: 'Balata', quantity: 1, unitPrice: 100, totalPrice: 120 }],
    });
    mockRepo.updateItem = vi.fn().mockResolvedValue({
      id: 'wo-1',
      items: [{ id: 'it-1', name: 'Balata', quantity: 3, unitPrice: 100, totalPrice: 360 }],
    });

    const result = await useCase.execute('t-1', 'wo-1', 'it-1', { quantity: 3 }, 'Ali');
    expect(result.items[0].quantity).toBe(3);
    expect(mockRepo.updateItem).toHaveBeenCalledWith('t-1', 'wo-1', 'it-1', { quantity: 3 }, 'Ali');
    expect(mockEvents.emitToTenant).toHaveBeenCalled();
  });
});
