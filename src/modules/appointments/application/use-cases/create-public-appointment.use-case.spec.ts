import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatePublicAppointmentUseCase } from './create-public-appointment.use-case';
import { IAppointmentRepository } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CreatePublicAppointmentUseCase', () => {
  let useCase: CreatePublicAppointmentUseCase;
  let mockRepo: IAppointmentRepository;
  let mockNotifications: any;
  let mockEvents: any;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      findTenantBySlug: vi.fn(),
      checkLiftConflict: vi.fn(),
      findOrCreateCustomerForPublic: vi.fn(),
      findOrCreateVehicleForPublic: vi.fn(),
    } as any;

    mockNotifications = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    mockEvents = {
      emitToTenant: vi.fn(),
    };

    useCase = new CreatePublicAppointmentUseCase(mockRepo, mockNotifications, mockEvents);
  });

  it('should throw NotFoundException if tenant slug is invalid', async () => {
    vi.mocked(mockRepo.findTenantBySlug).mockResolvedValue(null);

    await expect(
      useCase.execute('invalid-slug', {
        customerName: 'Ahmet',
        customerPhone: '0532',
        plate: '34ABC01',
        slotDate: '2026-04-01',
        slotStartTime: '2026-04-01T09:00:00Z',
        slotEndTime: '2026-04-01T10:00:00Z',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if lift has conflict', async () => {
    vi.mocked(mockRepo.findTenantBySlug).mockResolvedValue({ id: 'tenant-1', slug: 'oto-servis' } as any);
    vi.mocked(mockRepo.checkLiftConflict).mockResolvedValue(true);

    await expect(
      useCase.execute('oto-servis', {
        customerName: 'Ahmet',
        customerPhone: '0532',
        plate: '34ABC01',
        slotDate: '2026-04-01',
        slotStartTime: '2026-04-01T09:00:00Z',
        slotEndTime: '2026-04-01T10:00:00Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create public appointment successfully', async () => {
    vi.mocked(mockRepo.findTenantBySlug).mockResolvedValue({ id: 'tenant-1', slug: 'oto-servis' } as any);
    vi.mocked(mockRepo.checkLiftConflict).mockResolvedValue(false);
    vi.mocked(mockRepo.findOrCreateCustomerForPublic).mockResolvedValue({ id: 'cust-1' } as any);
    vi.mocked(mockRepo.findOrCreateVehicleForPublic).mockResolvedValue({ id: 'veh-1' } as any);

    const created = new AppointmentEntity({
      id: 'app-1',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      vehicleId: 'veh-1',
      slotDate: new Date('2026-04-01'),
      slotStartTime: new Date('2026-04-01T09:00:00Z'),
      slotEndTime: new Date('2026-04-01T10:00:00Z'),
      status: 'PENDING',
    });
    vi.mocked(mockRepo.create).mockResolvedValue(created);

    const result = await useCase.execute('oto-servis', {
      customerName: 'Ahmet',
      customerPhone: '0532',
      plate: '34ABC01',
      slotDate: '2026-04-01',
      slotStartTime: '2026-04-01T09:00:00Z',
      slotEndTime: '2026-04-01T10:00:00Z',
    });

    expect(result.id).toBe('app-1');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith('tenant-1', 'appointment:public_created', created);
  });
});
