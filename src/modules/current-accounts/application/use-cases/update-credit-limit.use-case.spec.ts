import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateCreditLimitUseCase } from './update-credit-limit.use-case';
import { ICurrentAccountRepository } from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';
import { NotFoundException } from '@nestjs/common';

describe('UpdateCreditLimitUseCase', () => {
  let useCase: UpdateCreditLimitUseCase;
  let mockRepo: ICurrentAccountRepository;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findByCustomerId: vi.fn(),
      customerExists: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    useCase = new UpdateCreditLimitUseCase(mockRepo);
  });

  it('should update creditLimit on existing current account', async () => {
    const existing = new CurrentAccountEntity({
      id: 'ca-1',
      tenantId: 't-1',
      customerId: 'c-1',
      creditLimit: 10000,
      isBlocked: false,
    });

    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(existing);
    vi.mocked(mockRepo.save).mockImplementation(async (acc) => acc);

    const result = await useCase.execute('t-1', 'c-1', 50000, true);

    expect(result.creditLimit).toBe(50000);
    expect(result.isBlocked).toBe(true);
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should throw NotFoundException if customer does not exist when creating initial account', async () => {
    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(null);
    vi.mocked(mockRepo.customerExists).mockResolvedValue(false);

    await expect(
      useCase.execute('t-1', 'c-non-existent', 50000),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create new account with given limit if account does not exist but customer exists', async () => {
    vi.mocked(mockRepo.findByCustomerId).mockResolvedValue(null);
    vi.mocked(mockRepo.customerExists).mockResolvedValue(true);

    const created = new CurrentAccountEntity({
      id: 'ca-new',
      tenantId: 't-1',
      customerId: 'c-2',
      creditLimit: 75000,
      isBlocked: false,
    });

    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute('t-1', 'c-2', 75000);

    expect(result.creditLimit).toBe(75000);
    expect(mockRepo.create).toHaveBeenCalled();
  });
});
