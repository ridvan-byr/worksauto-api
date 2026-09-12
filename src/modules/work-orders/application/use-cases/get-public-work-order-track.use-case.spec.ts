import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPublicWorkOrderTrackUseCase } from './get-public-work-order-track.use-case';
import { NotFoundException } from '@nestjs/common';

describe('GetPublicWorkOrderTrackUseCase', () => {
  let useCase: GetPublicWorkOrderTrackUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workOrder: {
        findFirst: vi.fn(),
      },
    };
    useCase = new GetPublicWorkOrderTrackUseCase(mockPrisma);
  });

  it('should throw NotFoundException if work order is not found', async () => {
    mockPrisma.workOrder.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('WO-9999-999')).rejects.toThrow(NotFoundException);
  });

  it('should return masked customer info and sanitized tracking details', async () => {
    mockPrisma.workOrder.findFirst.mockResolvedValue({
      id: 'wo-1',
      workOrderNumber: 'WO-2026-001',
      status: 'IN_PROGRESS',
      createdAt: new Date(),
      initialKm: 85000,
      customer: { firstName: 'Mehmet', lastName: 'Demir', phone: '05321234567' },
      vehicle: { plate: '34XYZ99', brand: 'Renault', model: 'Megane', year: 2021 },
      items: [
        { id: '1', itemType: 'SERVICE', name: 'Yağ Değişimi' },
        { id: '2', itemType: 'PART', name: 'Yağ Filtresi', quantity: 1 },
      ],
      photos: [],
      tenant: { title: 'Yıldız Oto Servis' },
    });

    const res = await useCase.execute('WO-2026-001');

    expect(res.workOrderNumber).toBe('WO-2026-001');
    expect(res.status).toBe('IN_PROGRESS');
    expect(res.customer.name).toContain('*');
    expect(res.customer.phone).toContain('***');
    expect(res.vehicle.plate).toBe('34XYZ99');
    expect(res.services.length).toBe(1);
    expect(res.parts.length).toBe(1);
  });
});
