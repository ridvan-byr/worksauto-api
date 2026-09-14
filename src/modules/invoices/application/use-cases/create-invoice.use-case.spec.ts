import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateInvoiceUseCase } from './create-invoice.use-case';
import { IInvoiceRepository } from '../../domain/invoice.repository.interface';
import { InvoiceEntity } from '../../domain/invoice.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;
  let mockRepo: IInvoiceRepository;
  let mockAudit: AuditService;
  let mockNotifications: NotificationsService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByWorkOrderId: vi.fn(),
      getNextInvoiceNumber: vi.fn().mockResolvedValue({
        invoiceNumber: 'INV-2026-00001',
        gibInvoiceNumber: 'GIB2026000000001',
      }),
      createWithCariMovement: vi.fn(),
      cancelWithCariReversal: vi.fn(),
      updateEInvoiceDetails: vi.fn(),
    };

    mockAudit = {
      log: vi.fn(),
    } as any;

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    } as any;

    const mockTemplateService = {
      generateBrandedHtmlEmail: vi.fn().mockReturnValue('<p>email</p>'),
      formatInvoiceCreatedCustomerMessage: vi.fn().mockReturnValue('mesaj'),
      getPaymentUrl: vi.fn().mockReturnValue('https://pay.example.com'),
    } as any;

    useCase = new CreateInvoiceUseCase(
      mockRepo,
      mockAudit,
      mockNotifications,
      mockTemplateService,
    );
  });

  it('should create an invoice and record audit log', async () => {
    const createdInvoice = new InvoiceEntity({
      id: 'inv-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date('2026-04-01'),
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
      status: 'UNPAID',
    });

    vi.mocked(mockRepo.createWithCariMovement).mockResolvedValue({
      invoice: createdInvoice,
      newBalance: 1200,
      creditLimit: 5000,
      customerName: 'Ahmet Yılmaz',
    });

    const result = await useCase.execute('tenant-1', {
      customerId: 'cust-1',
      dueDate: '2026-04-01',
      subtotal: 1000,
      kdvAmount: 200,
      grandTotal: 1200,
    });

    expect(result.invoiceNumber).toBe('INV-2026-00001');
    expect(result.grandTotal).toBe(1200);
    expect(mockRepo.createWithCariMovement).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice.created' }),
    );
    expect(mockNotifications.createNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.WARNING }),
    );
  });

  it('should trigger credit limit notification if new balance exceeds credit limit', async () => {
    const createdInvoice = new InvoiceEntity({
      id: 'inv-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-2026-00001',
      dueDate: new Date('2026-04-01'),
      subtotal: 3000,
      kdvAmount: 600,
      grandTotal: 3600,
      status: 'UNPAID',
    });

    vi.mocked(mockRepo.createWithCariMovement).mockResolvedValue({
      invoice: createdInvoice,
      newBalance: 6000,
      creditLimit: 5000,
      customerName: 'Ahmet Yılmaz',
    });

    await useCase.execute('tenant-1', {
      customerId: 'cust-1',
      dueDate: '2026-04-01',
      subtotal: 3000,
      kdvAmount: 600,
      grandTotal: 3600,
    });

    expect(mockNotifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Borç Limiti Aşıldı'),
      }),
    );
  });
});
