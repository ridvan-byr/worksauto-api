import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CancelAppointmentUseCase } from './cancel-appointment.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CancelAppointmentUseCase', () => {
  let useCase: CancelAppointmentUseCase;
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
      checkMechanicConflict: vi.fn(),
      checkLiftConflict: vi.fn(),
      cancelAppointmentAndWorkOrder: vi.fn(),
      findTenantBySlug: vi.fn(),
      findActiveOnlineBays: vi.fn(),
      findOrCreateCustomerForPublic: vi.fn(),
      findOrCreateVehicleForPublic: vi.fn(),
    };

    mockAudit = { log: vi.fn() } as any;
    mockNotifications = { createNotification: vi.fn() } as any;
    mockEvents = { emitToTenant: vi.fn() } as any;

    useCase = new CancelAppointmentUseCase(
      mockRepo,
      mockAudit,
      mockNotifications,
      mockEvents,
    );
  });

  it('should throw NotFoundException when appointment not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('tenant-1', 'non-existent', 'Test cancellation'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when trying to cancel an already completed appointment', async () => {
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
      useCase.execute('tenant-1', 'app-1', 'Test cancellation'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should cancel appointment, emit events, and log audit', async () => {
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

    const cancelled = new AppointmentEntity({
      ...existing,
      status: 'CANCELLED',
      cancellationReason: 'Müşteri vazgeçti',
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(existing);
    vi.mocked(mockRepo.cancelAppointmentAndWorkOrder).mockResolvedValue(
      cancelled,
    );

    const result = await useCase.execute(
      'tenant-1',
      'app-1',
      'Müşteri vazgeçti',
    );

    expect(result.status).toBe('CANCELLED');
    expect(mockRepo.cancelAppointmentAndWorkOrder).toHaveBeenCalledWith(
      'tenant-1',
      'app-1',
      'Müşteri vazgeçti',
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'appointment:cancelled',
      expect.any(Object),
    );
    expect(mockNotifications.createNotification).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'appointment.cancelled' }),
    );
  });
});
