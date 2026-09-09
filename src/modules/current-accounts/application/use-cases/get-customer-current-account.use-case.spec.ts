import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCustomerCurrentAccountUseCase } from './get-customer-current-account.use-case';
import { ICurrentAccountRepository } from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';
import { NotFoundException } from '@nestjs/common';

describe('GetCustomerCurrentAccountUseCase', () => {
  let useCase: GetCustomerCurrentAccountUseCase;
  let mockRepo: ICurrentAccountRepository;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findByCustomerId: vi.fn(),
      customerExists: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    useCase = new GetCustomerCurrentAccountUseCase(mockRepo);
  });

  it('should return existing current account when found', async () => {
    const existing = new CurrentAccountEntity({
      id: 'ca-1',
      tenantId: 't-1',
      customerId: 'c-1',
      balance: 500,
    });

    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(existing);

    const result = await useCase.execute('t-1', 'c-1');

    expect(result).toBeDefined();
    expect(result.balance).toBe(500);
    expect(mockRepo.customerExists).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException if account not found and customer does not exist', async () => {
    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(null);
    vi.mocked(mockRepo.customerExists).mockResolvedValue(false);

    await expect(useCase.execute('t-1', 'c-non-existent')).rejects.toThrow(NotFoundException);
  });

  it('should initialize and create new current account if customer exists but has no account yet', async () => {
    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(null);
    vi.mocked(mockRepo.customerExists).mockResolvedValue(true);

    const created = new CurrentAccountEntity({
      id: 'ca-new',
      tenantId: 't-1',
      customerId: 'c-2',
      balance: 0,
    });

    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute('t-1', 'c-2');

    expect(result).toBeDefined();
    expect(result.id).toBe('ca-new');
    expect(mockRepo.create).toHaveBeenCalled();
  });
});
