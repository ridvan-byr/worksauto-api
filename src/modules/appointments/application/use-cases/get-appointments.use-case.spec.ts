import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetAppointmentsUseCase } from './get-appointments.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { NotFoundException } from '@nestjs/common';

describe('GetAppointmentsUseCase', () => {
  let useCase: GetAppointmentsUseCase;
  let mockRepo: IAppointmentRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
    } as any;

    useCase = new GetAppointmentsUseCase(mockRepo);
  });

  it('should list all appointments for tenant', async () => {
    const list = [
      new AppointmentEntity({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: 't-1',
        customerId: 'c-1',
        vehicleId: 'v-1',
        slotDate: new Date(),
        slotStartTime: new Date(),
        slotEndTime: new Date(),
        status: 'CONFIRMED',
      }),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValue(list);

    const result = await useCase.execute('t-1', '2026-04-01');
    expect(result).toHaveLength(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', '2026-04-01');
  });

  it('should throw NotFoundException on non-uuid id', async () => {
    await expect(useCase.getById('t-1', 'invalid-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should get appointment by valid uuid', async () => {
    const validUuid = '11111111-1111-1111-1111-111111111111';
    const app = new AppointmentEntity({
      id: validUuid,
      tenantId: 't-1',
      customerId: 'c-1',
      vehicleId: 'v-1',
      slotDate: new Date(),
      slotStartTime: new Date(),
      slotEndTime: new Date(),
      status: 'CONFIRMED',
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(app);

    const result = await useCase.getById('t-1', validUuid);
    expect(result.id).toBe(validUuid);
  });
});
