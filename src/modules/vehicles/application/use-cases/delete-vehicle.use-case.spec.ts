import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteVehicleUseCase } from './delete-vehicle.use-case';
import { IVehicleRepository } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';
import { NotFoundException } from '@nestjs/common';

describe('DeleteVehicleUseCase', () => {
  let useCase: DeleteVehicleUseCase;
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

    useCase = new DeleteVehicleUseCase(mockRepo);
  });

  it('should throw NotFoundException if vehicle to delete does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute('t-1', 'v-missing')).rejects.toThrow(NotFoundException);
  });

  it('should soft delete vehicle when found', async () => {
    const vehicle = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC12',
      brand: 'Renault',
      model: 'Clio',
      year: 2019,
    });

    vi.mocked(mockRepo.findById).mockResolvedValue(vehicle);

    await useCase.execute('t-1', 'v-1');

    expect(mockRepo.softDelete).toHaveBeenCalledWith('t-1', 'v-1');
  });
});
