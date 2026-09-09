import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetVehiclesUseCase } from './get-vehicles.use-case';
import { IVehicleRepository } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';

describe('GetVehiclesUseCase', () => {
  let useCase: GetVehiclesUseCase;
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

    useCase = new GetVehiclesUseCase(mockRepo);
  });

  it('should return list of vehicles', async () => {
    const v1 = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'c-1',
      plate: '34ABC12',
      brand: 'Renault',
      model: 'Clio',
      year: 2019,
    });

    vi.mocked(mockRepo.findAll).mockResolvedValue([v1]);

    const result = await useCase.execute('t-1', { search: 'Clio' });

    expect(result).toHaveLength(1);
    expect(result[0].plate).toBe('34ABC12');
    expect(mockRepo.findAll).toHaveBeenCalledWith('t-1', { search: 'Clio' });
  });
});
