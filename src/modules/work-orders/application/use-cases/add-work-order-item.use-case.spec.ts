import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddWorkOrderItemUseCase } from './add-work-order-item.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('AddWorkOrderItemUseCase', () => {
  let useCase: AddWorkOrderItemUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: any;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      addItem: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new AddWorkOrderItemUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if work order is missing', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute(
        't-1',
        'wo-1',
        { itemType: 'PART', name: 'Filtre', quantity: 1, unitPrice: 100 },
        'Ali',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if work order is completed', async () => {
    mockRepo.findById = vi
      .fn()
      .mockResolvedValue({ id: 'wo-1', status: WorkOrderStatusEnum.COMPLETED });

    await expect(
      useCase.execute(
        't-1',
        'wo-1',
        { itemType: 'PART', name: 'Filtre', quantity: 1, unitPrice: 100 },
        'Ali',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should add item successfully and emit event', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
    });
    mockRepo.addItem = vi
      .fn()
      .mockResolvedValue({ id: 'item-1', name: 'Filtre' });

    const result = await useCase.execute(
      't-1',
      'wo-1',
      {
        itemType: 'PART',
        name: 'Filtre',
        quantity: 1,
        unitPrice: 100,
        kdvRate: 20,
      },
      'Ali',
    );

    expect(result.id).toBe('item-1');
    expect(mockRepo.addItem).toHaveBeenCalled();
    expect(mockEvents.emitToTenant).toHaveBeenCalled();
  });
});
