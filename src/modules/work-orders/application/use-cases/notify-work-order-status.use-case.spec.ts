import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotifyWorkOrderStatusUseCase } from './notify-work-order-status.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('NotifyWorkOrderStatusUseCase', () => {
  let useCase: NotifyWorkOrderStatusUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockNotifications: any;
  let mockAudit: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
    } as any;

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-123' }),
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    useCase = new NotifyWorkOrderStatusUseCase(
      mockRepo,
      mockNotifications,
      mockAudit,
    );
  });

  it('should throw NotFoundException if work order not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'wo-nonexistent', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if work order has no customer', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue({
      id: 'wo-1',
      tenantId: 't-1',
      customer: null,
    } as any);

    await expect(useCase.execute('t-1', 'wo-1', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should successfully dispatch notification and write audit log', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue({
      id: 'wo-1',
      tenantId: 't-1',
      workOrderNumber: 'WO-1001',
      status: WorkOrderStatusEnum.COMPLETED,
      customer: {
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        phone: '05523741500',
        email: 'ahmet@example.com',
      },
      vehicle: {
        plate: '34ABC123',
      },
      tenant: {
        title: 'Bayar Oto Servis',
      },
    } as any);

    const result = await useCase.execute(
      't-1',
      'wo-1',
      {
        channels: ['EMAIL', 'WHATSAPP'],
        customMessage: 'Test sürüşü tamamlandı, aracınızı alabilirsiniz.',
      },
      'user-1',
    );

    expect(result.success).toBe(true);
    expect(result.notificationId).toBe('notif-123');
    expect(result.channels.email).toBe(true);
    expect(result.channels.whatsapp).toBe(true);
    expect(mockNotifications.createNotification).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WORK_ORDER_STATUS_NOTIFIED',
        entityId: 'wo-1',
      }),
    );
  });
});
