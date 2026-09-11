import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateWorkOrderStatusUseCase } from './update-work-order-status.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { CreateInvoiceUseCase } from '../../../invoices/application/use-cases/create-invoice.use-case';
import { NotFoundException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('UpdateWorkOrderStatusUseCase', () => {
  let useCase: UpdateWorkOrderStatusUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockCreateInvoice: CreateInvoiceUseCase;
  let mockAudit: any;
  let mockEvents: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      restoreCancelledStock: vi.fn().mockResolvedValue({}),
    } as any;

    mockCreateInvoice = {
      execute: vi.fn().mockResolvedValue({}),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    useCase = new UpdateWorkOrderStatusUseCase(
      mockRepo,
      mockCreateInvoice,
      mockAudit,
      mockEvents,
      mockNotifications,
    );
  });

  it('should throw NotFoundException if work order is missing', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'wo-1', 'IN_PROGRESS')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update status and trigger audit log', async () => {
    const existing = {
      id: 'wo-1',
      tenantId: 't-1',
      workOrderNumber: 'WO-001',
      status: WorkOrderStatusEnum.QUEUE,
      vehicle: { plate: '34ABC01' },
      customer: { firstName: 'Ali', lastName: 'Yılmaz' },
    };
    mockRepo.findById = vi.fn().mockResolvedValue(existing);
    mockRepo.updateStatus = vi.fn().mockResolvedValue({
      ...existing,
      status: WorkOrderStatusEnum.IN_PROGRESS,
    });

    const result = await useCase.execute(
      't-1',
      'wo-1',
      'IN_PROGRESS',
      'user-1',
    );
    expect(result.status).toBe(WorkOrderStatusEnum.IN_PROGRESS);
    expect(mockAudit.log).toHaveBeenCalled();
    expect(mockEvents.emitToTenant).toHaveBeenCalled();
  });
});
