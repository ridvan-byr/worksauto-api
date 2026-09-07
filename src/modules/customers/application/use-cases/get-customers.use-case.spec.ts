import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetCustomersUseCase } from './get-customers.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';
import { NotFoundException } from '@nestjs/common';

describe('GetCustomersUseCase', () => {
  let useCase: GetCustomersUseCase;
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

    useCase = new GetCustomersUseCase(mockRepo);
  });

  it('should list customers for tenant', async () => {
    const list = [
      new CustomerEntity({ id: 'c-1', tenantId: 't-1', firstName: 'Ali', lastName: 'Veli', phone: '0532' }),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValue(list);

    const result = await useCase.execute('t-1', 'Ali');
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', 'Ali');
  });

  it('should get customer by id or throw NotFoundException', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.getById('t-1', 'nonexistent')).rejects.toThrow(NotFoundException);

    const customer = new CustomerEntity({ id: 'c-1', tenantId: 't-1', firstName: 'Ali', lastName: 'Veli', phone: '0532' });
    vi.mocked(mockRepo.findById).mockResolvedValue(customer);

    const result = await useCase.getById('t-1', 'c-1');
    expect(result.id).toBe('c-1');
  });

  it('should return customer stats', async () => {
    const customer = new CustomerEntity({ id: 'c-1', tenantId: 't-1', firstName: 'Ali', lastName: 'Veli', phone: '0532' });
    vi.mocked(mockRepo.findById).mockResolvedValue(customer);
    vi.mocked(mockRepo.getCustomerStats).mockResolvedValue({
      totalAppointments: 5,
      completedAppointments: 4,
      cancelledAppointments: 1,
      noShowCount: 0,
      noShowRate: '0%',
      attendanceScore: 100,
      riskCategory: 'LOW',
      balance: 1500,
      totalDebits: 2000,
      totalCredits: 500,
      creditLimit: 5000,
      limitExceeded: false,
    });

    const stats = await useCase.getStats('t-1', 'c-1');
    expect(stats.totalAppointments).toBe(5);
    expect(stats.balance).toBe(1500);
  });

  it('should soft delete customer', async () => {
    const customer = new CustomerEntity({ id: 'c-1', tenantId: 't-1', firstName: 'Ali', lastName: 'Veli', phone: '0532' });
    vi.mocked(mockRepo.findById).mockResolvedValue(customer);
    vi.mocked(mockRepo.softDelete).mockResolvedValue(customer);

    const result = await useCase.softDelete('t-1', 'c-1');
    expect(result.id).toBe('c-1');
    expect(mockRepo.softDelete).toHaveBeenCalledWith('t-1', 'c-1');
  });
});
