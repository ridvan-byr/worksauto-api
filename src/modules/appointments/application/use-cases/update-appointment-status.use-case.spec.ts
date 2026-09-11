import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateAppointmentStatusUseCase } from './update-appointment-status.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { NotFoundException } from '@nestjs/common';

describe('UpdateAppointmentStatusUseCase', () => {
  let useCase: UpdateAppointmentStatusUseCase;
  let mockRepo: IAppointmentRepository;
  let mockAudit: any;
  let mockNotifications: any;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      save: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue({}),
    };

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new UpdateAppointmentStatusUseCase(
      mockRepo,
      mockAudit,
      mockNotifications,
      mockEvents,
    );
  });

  it('should throw NotFoundException if appointment does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.approve('t-1', 'app-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should approve appointment and emit event', async () => {
    const app = new AppointmentEntity({
      id: 'app-1',
      tenantId: 't-1',
      customerId: 'c-1',
      vehicleId: 'v-1',
      slotDate: new Date(),
      slotStartTime: new Date(),
      slotEndTime: new Date(),
      status: 'PENDING',
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(app);
    vi.mocked(mockRepo.save).mockImplementation(async (entity) => entity);

    const result = await useCase.approve('t-1', 'app-1', 'u-1');
    expect(result.status).toBe('CONFIRMED');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      't-1',
      'appointment:approved',
      expect.anything(),
    );
    expect(mockAudit.log).toHaveBeenCalled();
  });

  it('should mark no-show for appointment', async () => {
    const app = new AppointmentEntity({
      id: 'app-1',
      tenantId: 't-1',
      customerId: 'c-1',
      vehicleId: 'v-1',
      slotDate: new Date(),
      slotStartTime: new Date(),
      slotEndTime: new Date(),
      status: 'CONFIRMED',
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(app);
    vi.mocked(mockRepo.save).mockImplementation(async (entity) => entity);

    const result = await useCase.markNoShow('t-1', 'app-1', 'u-1');
    expect(result.status).toBe('NO_SHOW');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      't-1',
      'appointment:no_show',
      expect.anything(),
    );
  });
});
