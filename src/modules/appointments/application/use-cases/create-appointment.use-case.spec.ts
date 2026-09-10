import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateAppointmentUseCase } from './create-appointment.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { QueueService } from '../../../queues/queue.service';
import { ConflictException } from '@nestjs/common';

describe('CreateAppointmentUseCase', () => {
  let useCase: CreateAppointmentUseCase;
  let mockRepo: IAppointmentRepository;
  let mockAudit: AuditService;
  let mockNotifications: NotificationsService;
  let mockEvents: EventsGateway;
  let mockQueue: QueueService;

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
    mockQueue = { scheduleAppointmentReminder: vi.fn() } as any;

    useCase = new CreateAppointmentUseCase(
      mockRepo,
      mockAudit,
      mockNotifications,
      mockEvents,
      mockQueue,
    );
  });

  it('should throw ConflictException if mechanic has a conflicting slot', async () => {
    vi.mocked(mockRepo.checkMechanicConflict).mockResolvedValue(true);

    await expect(
      useCase.execute('tenant-1', {
        customerId: 'cust-1',
        vehicleId: 'veh-1',
        assignedMechanicId: 'mech-1',
        slotDate: '2026-09-12',
        slotStartTime: '2026-09-12T09:00:00.000Z',
        slotEndTime: '2026-09-12T10:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException if lift has a conflicting slot', async () => {
    vi.mocked(mockRepo.checkLiftConflict).mockResolvedValue(true);

    await expect(
      useCase.execute('tenant-1', {
        customerId: 'cust-1',
        vehicleId: 'veh-1',
        assignedLift: 'Lift 1',
        slotDate: '2026-09-12',
        slotStartTime: '2026-09-12T09:00:00.000Z',
        slotEndTime: '2026-09-12T10:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create an appointment, emit events, and log audit', async () => {
    const createdAppointment = new AppointmentEntity({
      id: 'app-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      slotDate: new Date('2026-09-12'),
      slotStartTime: new Date('2026-09-12T09:00:00.000Z'),
      slotEndTime: new Date('2026-09-12T10:00:00.000Z'),
      status: 'CONFIRMED',
    });

    vi.mocked(mockRepo.create).mockResolvedValue(createdAppointment);

    const result = await useCase.execute('tenant-1', {
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      slotDate: '2026-09-12',
      slotStartTime: '2026-09-12T09:00:00.000Z',
      slotEndTime: '2026-09-12T10:00:00.000Z',
    });

    expect(result.id).toBe('app-1');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'appointment:created',
      createdAppointment,
    );
    expect(mockNotifications.createNotification).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'appointment.created' }),
    );
  });
});
