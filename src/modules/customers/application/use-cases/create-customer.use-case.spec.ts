import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateCustomerUseCase } from './create-customer.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';
import { ConflictException } from '@nestjs/common';

describe('CreateCustomerUseCase', () => {
  let useCase: CreateCustomerUseCase;
  let mockRepo: ICustomerRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      softDelete: vi.fn(),
      findByPhone: vi.fn(),
      getCustomerStats: vi.fn(),
      quickLead: vi.fn(),
      batchImport: vi.fn(),
      anonymizeCustomer: vi.fn(),
    };

    useCase = new CreateCustomerUseCase(mockRepo);
  });

  it('should throw ConflictException if customer with same phone exists', async () => {
    const existing = new CustomerEntity({
      id: 'c-1',
      tenantId: 't-1',
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '05321112233',
    });

    vi.mocked(mockRepo.findByPhone).mockResolvedValue(existing);

    await expect(
      useCase.execute('t-1', {
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '0532-111-22-33',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create customer when phone is unique', async () => {
    vi.mocked(mockRepo.findByPhone).mockResolvedValue(null);

    const created = new CustomerEntity({
      id: 'c-2',
      tenantId: 't-1',
      firstName: 'Zeynep',
      lastName: 'Kaya',
      phone: '05442223344',
    });

    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute('t-1', {
      firstName: 'Zeynep',
      lastName: 'Kaya',
      phone: '0544 222 33 44',
    });

    expect(result.id).toBe('c-2');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '05442223344' }),
    );
  });
});
