import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateWorkOrderUseCase } from './create-work-order.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderEntity } from '../../domain/entities/work-order.entity';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';

describe('CreateWorkOrderUseCase', () => {
  let useCase: CreateWorkOrderUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockEvents: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockRepo = {
      getNextWorkOrderNumber: vi.fn().mockResolvedValue('WO-2026-00001'),
      create: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      findAll: vi.fn(),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    useCase = new CreateWorkOrderUseCase(
      mockRepo,
      mockEvents,
      mockNotifications,
    );
  });

  it('should create a work order atomically with items and author passed to repository', async () => {
    const created = new WorkOrderEntity({
      id: 'wo-1',
      tenantId: 't-1',
      workOrderNumber: 'WO-2026-00001',
      customerId: 'c-1',
      vehicleId: 'v-1',
      status: WorkOrderStatusEnum.OPEN,
      subtotal: 500,
      kdvTotal: 100,
      grandTotal: 600,
      initialKm: 50000,
    });
    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute(
      't-1',
      {
        customerId: 'c-1',
        vehicleId: 'v-1',
        initialKm: 50000,
        items: [
          {
            itemType: 'PART',
            itemId: 'prod-1',
            name: 'Balata',
            quantity: 2,
            unitPrice: 250,
            kdvRate: 20,
          },
        ],
      },
      'Ustabaşı Ali',
      'user-1',
    );

    expect(result.id).toBe('wo-1');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't-1',
        workOrderNumber: 'WO-2026-00001',
        author: 'Ustabaşı Ali',
        items: expect.arrayContaining([
          expect.objectContaining({
            itemId: 'prod-1',
            itemType: 'PART',
            quantity: 2,
            unitPrice: 250,
          }),
        ]),
      }),
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      't-1',
      'work_order:created',
      expect.anything(),
    );
  });
});
