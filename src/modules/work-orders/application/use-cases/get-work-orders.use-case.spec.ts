import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetWorkOrdersUseCase } from './get-work-orders.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException } from '@nestjs/common';

describe('GetWorkOrdersUseCase', () => {
  let useCase: GetWorkOrdersUseCase;
  let mockRepo: IWorkOrderRepository;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
    } as any;

    useCase = new GetWorkOrdersUseCase(mockRepo);
  });

  it('should find all work orders for tenant', async () => {
    mockRepo.findAll = vi.fn().mockResolvedValue([{ id: 'wo-1' }]);

    const result = await useCase.findAll('t-1', 'OPEN');
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', 'OPEN');
  });

  it('should throw NotFoundException if work order does not exist', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.findOne('t-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
