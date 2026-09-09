import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateVehicleUseCase } from './create-vehicle.use-case';
import { IVehicleRepository } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('CreateVehicleUseCase', () => {
  let useCase: CreateVehicleUseCase;
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

    useCase = new CreateVehicleUseCase(mockRepo);
  });

  it('should throw ConflictException if vehicle with plate already exists', async () => {
    const existing = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC123',
      brand: 'BMW',
      model: '320i',
      year: 2022,
    });

    vi.mocked(mockRepo.findByPlate).mockResolvedValue(existing);

    await expect(
      useCase.execute('t-1', {
        customerId: 'c-1',
        plate: '34 abc 123',
        brand: 'BMW',
        model: '320i',
        year: 2022,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if vehicle year is invalid', async () => {
    vi.mocked(mockRepo.findByPlate).mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', {
        customerId: 'c-1',
        plate: '34XYZ99',
        brand: 'Ford',
        model: 'Focus',
        year: 1940, // < 1950
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create and save vehicle successfully', async () => {
    vi.mocked(mockRepo.findByPlate).mockResolvedValue(null);

    const saved = new VehicleEntity({
      id: 'v-2',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34XYZ99',
      brand: 'Ford',
      model: 'Focus',
      year: 2021,
    });

    vi.mocked(mockRepo.save).mockResolvedValue(saved);

    const result = await useCase.execute('t-1', {
      customerId: 'c-1',
      plate: '34 xyz 99',
      brand: 'Ford',
      model: 'Focus',
      year: 2021,
    });

    expect(result).toBeDefined();
    expect(result.plate).toBe('34XYZ99');
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
