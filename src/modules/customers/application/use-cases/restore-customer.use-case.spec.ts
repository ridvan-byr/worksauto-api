import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestoreCustomerUseCase } from './restore-customer.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';
import { NotFoundException } from '@nestjs/common';

describe('RestoreCustomerUseCase', () => {
  let useCase: RestoreCustomerUseCase;
  let mockRepo: ICustomerRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
      findByPhone: vi.fn(),
      findDeletedByPhone: vi.fn(),
      getCustomerStats: vi.fn(),
      quickLead: vi.fn(),
      batchImport: vi.fn(),
      anonymizeCustomer: vi.fn(),
    };

    useCase = new RestoreCustomerUseCase(mockRepo);
  });

  it('should restore soft-deleted customer successfully', async () => {
    const restored = new CustomerEntity({
      id: 'cust-1',
      tenantId: 't-1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      phone: '05321112233',
    });

    vi.mocked(mockRepo.restore).mockResolvedValue(restored);

    const result = await useCase.execute('t-1', 'cust-1');
    expect(result).toBeDefined();
    expect(result.id).toBe('cust-1');
    expect(mockRepo.restore).toHaveBeenCalledWith('t-1', 'cust-1');
  });

  it('should throw NotFoundException if customer to restore is not found', async () => {
    vi.mocked(mockRepo.restore).mockRejectedValue(
      new NotFoundException('Arşivlenmiş müşteri bulunamadı.'),
    );

    await expect(useCase.execute('t-1', 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should detect if phone belongs to active customer', async () => {
    const active = new CustomerEntity({
      id: 'c-active',
      tenantId: 't-1',
      firstName: 'Mehmet',
      lastName: 'Kaya',
      phone: '05329998877',
    });
    vi.mocked(mockRepo.findByPhone).mockResolvedValue(active);

    const res = await useCase.checkPhone('t-1', '0532 999 88 77');
    expect(res.exists).toBe(true);
    expect(res.isDeleted).toBe(false);
    expect(res.customer?.id).toBe('c-active');
  });

  it('should detect if phone belongs to soft-deleted customer', async () => {
    vi.mocked(mockRepo.findByPhone).mockResolvedValue(null);
    const deleted = new CustomerEntity({
      id: 'c-deleted',
      tenantId: 't-1',
      firstName: 'Ali',
      lastName: 'Demir',
      phone: '05324445566',
    });
    vi.mocked(mockRepo.findDeletedByPhone).mockResolvedValue(deleted);

    const res = await useCase.checkPhone('t-1', '0532 444 55 66');
    expect(res.exists).toBe(true);
    expect(res.isDeleted).toBe(true);
    expect(res.customer?.id).toBe('c-deleted');
  });
});
