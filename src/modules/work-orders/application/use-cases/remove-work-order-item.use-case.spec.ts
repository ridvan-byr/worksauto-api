import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoveWorkOrderItemUseCase } from './remove-work-order-item.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('RemoveWorkOrderItemUseCase', () => {
  let useCase: RemoveWorkOrderItemUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: any;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      removeItem: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new RemoveWorkOrderItemUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if work order not found', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', 'Ali')).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if work order is cancelled', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({ id: 'wo-1', status: WorkOrderStatusEnum.CANCELLED });

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', 'Ali')).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if item is not found in work order', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
      items: [],
    });

    await expect(useCase.execute('t-1', 'wo-1', 'it-1', 'Ali')).rejects.toThrow(NotFoundException);
  });

  it('should remove item successfully', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
      items: [{ id: 'it-1', name: 'Balata', quantity: 1, unitPrice: 100, totalPrice: 120 }],
    });
    mockRepo.removeItem = vi.fn().mockResolvedValue({ id: 'wo-1', items: [] });

    const result = await useCase.execute('t-1', 'wo-1', 'it-1', 'Ali');
    expect(result.items).toHaveLength(0);
    expect(mockRepo.removeItem).toHaveBeenCalledWith('t-1', 'wo-1', 'it-1', 'Ali');
    expect(mockEvents.emitToTenant).toHaveBeenCalled();
  });
});
