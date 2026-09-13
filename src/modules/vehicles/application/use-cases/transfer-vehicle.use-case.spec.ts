import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransferVehicleUseCase } from './transfer-vehicle.use-case';
import { IVehicleRepository } from '../../domain/vehicle.repository.interface';
import { VehicleEntity } from '../../domain/vehicle.entity';
import { BadRequestException } from '@nestjs/common';

describe('TransferVehicleUseCase', () => {
  let useCase: TransferVehicleUseCase;
  let mockRepo: IVehicleRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByPlate: vi.fn(),
      findByPlateAny: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      transferOwnership: vi.fn(),
    };

    useCase = new TransferVehicleUseCase(mockRepo);
  });

  it('should transfer vehicle ownership successfully', async () => {
    const transferred = new VehicleEntity({
      id: 'v-10',
      tenantId: 't-1',
      customerId: 'new-cust',
      plate: '34ABC123',
      brand: 'Audi',
      model: 'A4',
      year: 2020,
    });

    vi.mocked(mockRepo.transferOwnership).mockResolvedValue(transferred);

    const result = await useCase.execute('t-1', 'v-10', 'new-cust');
    expect(result.customerId).toBe('new-cust');
    expect(mockRepo.transferOwnership).toHaveBeenCalledWith(
      't-1',
      'v-10',
      'new-cust',
    );
  });

  it('should throw BadRequestException if missing vehicleId or newCustomerId', async () => {
    await expect(useCase.execute('t-1', '', 'new-cust')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should check plate and return owner info', async () => {
    const vehicle = new VehicleEntity({
      id: 'v-1',
      tenantId: 't-1',
      customerId: 'old-cust',
      plate: '34ABC123',
      brand: 'BMW',
      model: '320i',
      year: 2022,
      customer: {
        id: 'old-cust',
        firstName: 'Ali',
        lastName: 'Veli',
        phone: '05321112233',
      },
    });

    vi.mocked(mockRepo.findByPlateAny).mockResolvedValue(vehicle);

    const check = await useCase.checkPlate('t-1', '34 ABC 123');
    expect(check.exists).toBe(true);
    expect(check.ownerName).toBe('Ali Veli');
    expect(check.plate).toBe('34ABC123');
  });
});
