import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCurrentAccountsUseCase } from './get-current-accounts.use-case';
import { ICurrentAccountRepository } from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';

describe('GetCurrentAccountsUseCase', () => {
  let useCase: GetCurrentAccountsUseCase;
  let mockRepo: ICurrentAccountRepository;

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findByCustomerId: vi.fn(),
      customerExists: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    useCase = new GetCurrentAccountsUseCase(mockRepo);
  });

  it('should return list of current accounts for tenant', async () => {
    const ca1 = new CurrentAccountEntity({
      id: 'ca-1',
      tenantId: 't-1',
      customerId: 'c-1',
      balance: 1500,
    });

    vi.mocked(mockRepo.findAll).mockResolvedValue([ca1]);

    const result = await useCase.execute('t-1');

    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(1500);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1');
  });
});
