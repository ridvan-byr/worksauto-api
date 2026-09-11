import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddWorkOrderPhotoUseCase } from './add-work-order-photo.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotFoundException } from '@nestjs/common';

describe('AddWorkOrderPhotoUseCase', () => {
  let useCase: AddWorkOrderPhotoUseCase;
  let mockRepo: IWorkOrderRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      addPhoto: vi.fn(),
    } as any;

    useCase = new AddWorkOrderPhotoUseCase(mockRepo);
  });

  it('should throw NotFoundException if work order is missing', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute(
        't-1',
        'wo-1',
        'http://photo.jpg',
        'Ön tampon',
        'BEFORE',
        'Ali',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should add photo via repository', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({ id: 'wo-1' });
    mockRepo.addPhoto = vi
      .fn()
      .mockResolvedValue({ id: 'photo-1', url: 'http://photo.jpg' });

    const result = await useCase.execute(
      't-1',
      'wo-1',
      'http://photo.jpg',
      'Ön tampon',
      'BEFORE',
      'Ali',
    );
    expect(result.id).toBe('photo-1');
    expect(mockRepo.addPhoto).toHaveBeenCalledWith(
      't-1',
      'wo-1',
      'http://photo.jpg',
      'Ön tampon',
      'BEFORE',
      'Ali',
    );
  });
});
