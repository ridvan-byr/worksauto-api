import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RollbackWorkOrderUseCase } from './rollback-work-order.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('RollbackWorkOrderUseCase', () => {
  let useCase: RollbackWorkOrderUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      rollbackStatus: vi.fn(),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new RollbackWorkOrderUseCase(mockRepo, mockEvents);
  });

  it('should throw NotFoundException if work order is missing', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'wo-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if cannot rollback from first status', async () => {
    mockRepo.findById = vi
      .fn()
      .mockResolvedValue({ id: 'wo-1', status: WorkOrderStatusEnum.QUEUE });

    await expect(useCase.execute('t-1', 'wo-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should rollback from IN_PROGRESS to QUEUE and emit event', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.IN_PROGRESS,
      workOrderNumber: 'WO-001',
      vehicle: { plate: '34ABC01' },
    });
    mockRepo.rollbackStatus = vi.fn().mockResolvedValue({
      id: 'wo-1',
      status: WorkOrderStatusEnum.QUEUE,
    });

    const result = await useCase.execute('t-1', 'wo-1');
    expect(result.status).toBe(WorkOrderStatusEnum.QUEUE);
    expect(mockRepo.rollbackStatus).toHaveBeenCalledWith(
      't-1',
      'wo-1',
      WorkOrderStatusEnum.QUEUE,
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalled();
  });
});
