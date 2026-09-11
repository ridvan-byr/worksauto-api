import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RescheduleAppointmentUseCase } from './reschedule-appointment.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('RescheduleAppointmentUseCase', () => {
  let useCase: RescheduleAppointmentUseCase;
  let mockRepo: IAppointmentRepository;
  let mockAudit: AuditService;
  let mockNotifications: NotificationsService;
  let mockEvents: EventsGateway;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      checkMechanicConflict: vi.fn().mockResolvedValue(false),
      checkLiftConflict: vi.fn().mockResolvedValue(false),
      cancelAppointmentAndWorkOrder: vi.fn(),
      findTenantBySlug: vi.fn(),
      findActiveOnlineBays: vi.fn(),
      findOrCreateCustomerForPublic: vi.fn(),
      findOrCreateVehicleForPublic: vi.fn(),
    };

    mockAudit = { log: vi.fn() } as any;
    mockNotifications = { createNotification: vi.fn() } as any;
    mockEvents = { emitToTenant: vi.fn() } as any;

    useCase = new RescheduleAppointmentUseCase(
      mockRepo,
      mockAudit,
      mockNotifications,
      mockEvents,
    );
  });

  it('should throw NotFoundException when appointment not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'non-existent', {
        slotDate: '2026-09-15',
        slotStartTime: '2026-09-15T09:00:00.000Z',
        slotEndTime: '2026-09-15T10:00:00.000Z',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when trying to reschedule a completed appointment', async () => {
    const completed = new AppointmentEntity({
      id: 'app-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      slotDate: new Date('2026-09-10'),
      slotStartTime: new Date('2026-09-10T09:00:00.000Z'),
      slotEndTime: new Date('2026-09-10T10:00:00.000Z'),
      status: 'COMPLETED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(completed);

    await expect(
      useCase.execute('tenant-1', 'app-1', {
        slotDate: '2026-09-15',
        slotStartTime: '2026-09-15T09:00:00.000Z',
        slotEndTime: '2026-09-15T10:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw ConflictException when new slot has conflict', async () => {
    const existing = new AppointmentEntity({
      id: 'app-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      assignedMechanicId: 'mech-1',
      slotDate: new Date('2026-09-10'),
      slotStartTime: new Date('2026-09-10T09:00:00.000Z'),
      slotEndTime: new Date('2026-09-10T10:00:00.000Z'),
      status: 'CONFIRMED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.checkMechanicConflict).mockResolvedValue(true);

    await expect(
      useCase.execute('tenant-1', 'app-1', {
        slotDate: '2026-09-15',
        slotStartTime: '2026-09-15T09:00:00.000Z',
        slotEndTime: '2026-09-15T10:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reschedule successfully and emit event', async () => {
    const existing = new AppointmentEntity({
      id: 'app-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      slotDate: new Date('2026-09-10'),
      slotStartTime: new Date('2026-09-10T09:00:00.000Z'),
      slotEndTime: new Date('2026-09-10T10:00:00.000Z'),
      status: 'CONFIRMED',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.save).mockImplementation(async (item) => item);

    const result = await useCase.execute('tenant-1', 'app-1', {
      slotDate: '2026-09-15',
      slotStartTime: '2026-09-15T14:00:00.000Z',
      slotEndTime: '2026-09-15T15:00:00.000Z',
    });

    expect(result.slotDate).toEqual(new Date('2026-09-15'));
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'appointment:rescheduled',
      expect.any(Object),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'appointment.rescheduled' }),
    );
  });
});
