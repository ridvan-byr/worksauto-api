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

  it('should throw BadRequestException when reason is empty or too short', async () => {
    const invoice = new InvoiceEntity({
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

    vi.mocked(mockRepo.findById).mockResolvedValue(invoice);

    await expect(
      useCase.execute('tenant-1', 'inv-1', 'abc'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when invoice is already cancelled', async () => {
    const cancelledInvoice = new InvoiceEntity({
      id: 'inv-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date('2026-04-01'),
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
      paidAmount: 0,
      remainingAmount: 0,
      status: 'CANCELLED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(cancelledInvoice);

    await expect(
      useCase.execute('tenant-1', 'inv-1', 'Zaten iptal edilmişti'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully cancel a paid invoice and record audit log with advance transfer', async () => {
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

    const cancelledInvoice = new InvoiceEntity({
      ...paidInvoice,
      status: 'CANCELLED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(paidInvoice);
    vi.mocked(mockRepo.cancelWithCariReversal).mockResolvedValue(cancelledInvoice);

    const result = await useCase.execute(
      'tenant-1',
      'inv-1',
      'İş emrine ilave onarım eklenecek',
      'user-123',
    );

    expect(result.status).toBe('CANCELLED');
    expect(mockRepo.cancelWithCariReversal).toHaveBeenCalledWith(
      'tenant-1',
      'inv-1',
      'İş emrine ilave onarım eklenecek',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'invoice.cancelled',
        changesAfter: expect.objectContaining({
          transferredToAdvance: 1200,
        }),
      }),
    );
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

    const result = await useCase.execute('tenant-1', 'inv-1', 'Hatalı giriş iptali');

    expect(result.status).toBe('CANCELLED');
    expect(mockRepo.cancelWithCariReversal).toHaveBeenCalledWith(
      'tenant-1',
      'inv-1',
      'Hatalı giriş iptali',
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice.cancelled' }),
    );
  });

  it('should throw BadRequestException when invoice or work order completion is older than 48 hours', async () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const staleInvoice = new InvoiceEntity({
      id: 'inv-stale',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date(),
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
      paidAmount: 1200,
      remainingAmount: 0,
      status: 'PAID',
      createdAt: threeDaysAgo,
      workOrder: {
        completedAt: threeDaysAgo,
      },
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(staleInvoice);

    await expect(
      useCase.execute('tenant-1', 'inv-stale', 'Eski fatura iptali'),
    ).rejects.toThrow(BadRequestException);
  });
});
