import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuickLeadUseCase } from './quick-lead.use-case';
import { ICustomerRepository } from '../../domain/customer.repository.interface';
import { BadRequestException } from '@nestjs/common';

describe('QuickLeadUseCase', () => {
  let useCase: QuickLeadUseCase;
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

    useCase = new QuickLeadUseCase(mockRepo);
  });

  it('should throw BadRequestException if required fields are missing', async () => {
    await expect(
      useCase.execute('t-1', {
        firstName: '',
        phone: '05321112233',
        plate: '34ABC01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create quick lead with sanitized plate and phone', async () => {
    vi.mocked(mockRepo.quickLead).mockResolvedValue({
      customer: { id: 'c-1', firstName: 'Kemal' },
      vehicle: { id: 'v-1', plate: '34ABC01' },
    } as any);

    const result = await useCase.execute('t-1', {
      firstName: 'Kemal',
      phone: '0532-111-22-33',
      plate: '34 abc 01',
    });

    expect(result.customer.id).toBe('c-1');
    expect(mockRepo.quickLead).toHaveBeenCalledWith('t-1', {
      firstName: 'Kemal',
      phone: '05321112233',
      plate: '34ABC01',
    });
  });
});
