import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateCustomerUseCase } from './update-customer.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('UpdateCustomerUseCase', () => {
  let useCase: UpdateCustomerUseCase;
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

    useCase = new UpdateCustomerUseCase(mockRepo);
  });

  it('should throw NotFoundException when customer not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'non-existent', { firstName: 'Mehmet' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if updated phone belongs to another customer', async () => {
    const current = new CustomerEntity({
      id: 'c-1',
      tenantId: 't-1',
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '05321112233',
    });

    const other = new CustomerEntity({
      id: 'c-2',
      tenantId: 't-1',
      firstName: 'Ahmet',
      lastName: 'Kaya',
      phone: '05329998877',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(current);
    vi.mocked(mockRepo.findByPhone).mockResolvedValue(other);

    await expect(
      useCase.execute('t-1', 'c-1', { phone: '05329998877' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update customer successfully', async () => {
    const current = new CustomerEntity({
      id: 'c-1',
      tenantId: 't-1',
      firstName: 'Ali',
      lastName: 'Veli',
      phone: '05321112233',
      creditLimit: 1000,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(current);
    vi.mocked(mockRepo.save).mockImplementation(async (c) => c);

    const result = await useCase.execute('t-1', 'c-1', {
      firstName: 'Alişan',
      creditLimit: 5000,
    });

    expect(result.firstName).toBe('Alişan');
    expect(result.creditLimit).toBe(5000);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
