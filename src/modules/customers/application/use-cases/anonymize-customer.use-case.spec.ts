import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnonymizeCustomerUseCase } from './anonymize-customer.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';
import { NotFoundException } from '@nestjs/common';

describe('AnonymizeCustomerUseCase', () => {
  let useCase: AnonymizeCustomerUseCase;
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

    useCase = new AnonymizeCustomerUseCase(mockRepo);
  });

  it('should throw NotFoundException if customer not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'cust-999', 'user-1', 'KVKK-2026-001'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should call repository.anonymizeCustomer when customer exists', async () => {
    const existing = new CustomerEntity({
      id: 'cust-1',
      tenantId: 'tenant-1',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
      phone: '05551112233',
    });

    const anonymized = new CustomerEntity({
      id: 'cust-1',
      tenantId: 'tenant-1',
      firstName: 'ANONİM',
      lastName: 'MÜŞTERİ',
      phone: '0000000000',
      isAnonymized: true,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.anonymizeCustomer).mockResolvedValue(anonymized);

    const result = await useCase.execute(
      'tenant-1',
      'cust-1',
      'user-1',
      'KVKK-2026-001',
    );

    expect(result.isAnonymized).toBe(true);
    expect(result.firstName).toBe('ANONİM');
    expect(mockRepo.anonymizeCustomer).toHaveBeenCalledWith(
      'tenant-1',
      'cust-1',
      'user-1',
      'KVKK-2026-001',
    );
  });
});
