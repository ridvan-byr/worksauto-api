import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitCustomerFeedbackUseCase } from './submit-customer-feedback.use-case';
import { NotFoundException } from '@nestjs/common';

describe('SubmitCustomerFeedbackUseCase', () => {
  let useCase: SubmitCustomerFeedbackUseCase;
  let mockWorkOrderRepository: any;
  let mockNotificationsService: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockWorkOrderRepository = {
      findPublicTrackByTokenOrNumber: vi.fn(),
      updateCustomerFeedback: vi.fn().mockResolvedValue({}),
    };
    mockNotificationsService = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new SubmitCustomerFeedbackUseCase(
      mockWorkOrderRepository,
      mockNotificationsService,
      mockAuditService,
    );
  });

  it('throws NotFoundException when work order is not found', async () => {
    mockWorkOrderRepository.findPublicTrackByTokenOrNumber.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute('invalid-token', { rating: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('handles positive 5-star review correctly', async () => {
    mockWorkOrderRepository.findPublicTrackByTokenOrNumber.mockResolvedValue({
      id: 'wo-1',
      tenantId: 'tenant-1',
      workOrderNumber: 'WO-2026-001',
      customer: { firstName: 'Ahmet', lastName: 'Yılmaz' },
      vehicle: { plate: '34ABC123' },
    });

    const result = await useCase.execute('token-123', {
      rating: 5,
      comment: 'Harika servis',
    });

    expect(result.success).toBe(true);
    expect(result.isPositive).toBe(true);
    expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(mockAuditService.log).toHaveBeenCalledTimes(1);
  });

  it('handles low 2-star feedback and creates warning notification for staff', async () => {
    mockWorkOrderRepository.findPublicTrackByTokenOrNumber.mockResolvedValue({
      id: 'wo-1',
      tenantId: 'tenant-1',
      workOrderNumber: 'WO-2026-001',
      customer: { firstName: 'Mehmet', lastName: 'Kaya' },
      vehicle: { plate: '06XYZ99' },
    });

    const result = await useCase.execute('token-123', {
      rating: 2,
      comment: 'Araç geç teslim edildi.',
    });

    expect(result.success).toBe(true);
    expect(result.isPositive).toBe(false);
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WARNING',
        category: 'WORK_ORDER',
      }),
    );
    expect(mockAuditService.log).toHaveBeenCalledTimes(1);
  });
});
