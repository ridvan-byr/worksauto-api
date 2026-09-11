import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateVehicleUseCase } from './update-vehicle.use-case';
import { IVehicleRepository } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('UpdateVehicleUseCase', () => {
  let useCase: UpdateVehicleUseCase;
  let mockRepo: IVehicleRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByPlate: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };

    useCase = new UpdateVehicleUseCase(mockRepo);
  });

  it('should throw NotFoundException if vehicle does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'v-non-existent', { brand: 'Audi' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if new plate belongs to another vehicle', async () => {
    const current = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC123',
      brand: 'BMW',
      model: '320i',
      year: 2020,
    });

    const another = new VehicleEntity({
      id: 'v-2',
      tenantId: 't-1',
      customerId: 'c-2',
      plate: '34DEF456',
      brand: 'Audi',
      model: 'A4',
      year: 2021,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(current);
    vi.mocked(mockRepo.findByPlate).mockResolvedValue(another);

    await expect(
      useCase.execute('t-1', 'v-1', { plate: '34DEF456' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if km is negative', async () => {
    const current = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC123',
      brand: 'BMW',
      model: '320i',
      year: 2020,
      currentKm: 50000,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(current);

    await expect(
      useCase.execute('t-1', 'v-1', { currentKm: -100 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update vehicle details successfully', async () => {
    const current = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC123',
      brand: 'BMW',
      model: '320i',
      year: 2020,
      currentKm: 50000,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(current);
    vi.mocked(mockRepo.update).mockImplementation(async (v) => v);

    const updated = await useCase.execute('t-1', 'v-1', {
      currentKm: 55000,
      color: 'Siyah',
    });

    expect(updated.currentKm).toBe(55000);
    expect(updated.color).toBe('Siyah');
    expect(mockRepo.update).toHaveBeenCalled();
  });
});
