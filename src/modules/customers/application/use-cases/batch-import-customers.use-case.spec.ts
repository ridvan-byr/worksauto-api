import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchImportCustomersUseCase } from './batch-import-customers.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';

describe('BatchImportCustomersUseCase', () => {
  let useCase: BatchImportCustomersUseCase;
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

    useCase = new BatchImportCustomersUseCase(mockRepo);
  });

  it('should delegate batch import to customer repository', async () => {
    const items = [
      { firstName: 'Ahmet', phone: '05321112233', plate: '34ABC01' },
    ];
    vi.mocked(mockRepo.batchImport).mockResolvedValue({
      importedCount: 1,
      errors: [],
    });

    const result = await useCase.execute('tenant-1', items);

    expect(result.importedCount).toBe(1);
    expect(mockRepo.batchImport).toHaveBeenCalledWith('tenant-1', items);
  });
});
