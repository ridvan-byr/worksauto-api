import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CancelInvoiceUseCase } from './cancel-invoice.use-case';
import { IInvoiceRepository } from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CancelInvoiceUseCase', () => {
  let useCase: CancelInvoiceUseCase;
  let mockRepo: IInvoiceRepository;
  let mockAudit: AuditService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByWorkOrderId: vi.fn(),
      getNextInvoiceNumber: vi.fn(),
      createWithCariMovement: vi.fn(),
      cancelWithCariReversal: vi.fn(),
    };

    mockAudit = {
      log: vi.fn(),
    } as any;

    useCase = new CancelInvoiceUseCase(mockRepo, mockAudit);
  });

  it('should throw NotFoundException when invoice not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'inv-non-existent', 'Test cancellation'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when trying to cancel an already paid invoice', async () => {
    const paidInvoice = new InvoiceEntity({
      id: 'inv-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date('2026-04-01'),
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
      paidAmount: 1200,
      remainingAmount: 0,
      status: 'PAID',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(paidInvoice);

    await expect(
      useCase.execute('tenant-1', 'inv-1', 'Test cancellation'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should cancel invoice and record audit log', async () => {
    const unpaidInvoice = new InvoiceEntity({
      id: 'inv-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date('2026-04-01'),
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
      paidAmount: 0,
      remainingAmount: 1200,
      status: 'UNPAID',
    });

    const cancelledInvoice = new InvoiceEntity({
      ...unpaidInvoice,
      status: 'CANCELLED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(unpaidInvoice);
    vi.mocked(mockRepo.cancelWithCariReversal).mockResolvedValue(
      cancelledInvoice,
    );

    const result = await useCase.execute('tenant-1', 'inv-1', 'Hatalı giriş');

    expect(result.status).toBe('CANCELLED');
    expect(mockRepo.cancelWithCariReversal).toHaveBeenCalledWith(
      'tenant-1',
      'inv-1',
      'Hatalı giriş',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice.cancelled' }),
    );
  });
});
