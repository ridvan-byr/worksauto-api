import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetInvoicesUseCase } from './get-invoices.use-case';
import { IInvoiceRepository } from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { NotFoundException } from '@nestjs/common';

describe('GetInvoicesUseCase', () => {
  let useCase: GetInvoicesUseCase;
  let mockRepo: IInvoiceRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
    } as any;

    useCase = new GetInvoicesUseCase(mockRepo);
  });

  it('should list invoices for tenant', async () => {
    const list = [
      new InvoiceEntity({
        id: 'inv-1',
        tenantId: 't-1',
        customerId: 'c-1',
        invoiceNumber: 'INV-001',
        dueDate: new Date(),
        subtotal: 100,
        kdvAmount: 20,
        grandTotal: 120,
        status: 'PAID',
      }),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValue(list);

    const result = await useCase.execute('t-1', 'PAID');
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', 'PAID');
  });

  it('should throw NotFoundException if invoice is not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.getById('t-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
