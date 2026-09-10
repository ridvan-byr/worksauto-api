import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManageShelvesUseCase } from './manage-shelves.use-case';
import { IShelfRepository } from '../../domain/shelf.repository.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ManageShelvesUseCase', () => {
  let useCase: ManageShelvesUseCase;
  let mockShelfRepo: IShelfRepository;

  beforeEach(() => {
    mockShelfRepo = {
      findByCode: vi.fn(),
      createShelfWithCells: vi.fn(),
      findAllWithStats: vi.fn(),
      findByIdWithMatrix: vi.fn(),
      findProduct: vi.fn(),
      findCell: vi.fn(),
      updateProductLocation: vi.fn(),
      findShelfById: vi.fn(),
      deleteShelf: vi.fn(),
    };

    useCase = new ManageShelvesUseCase(mockShelfRepo);
  });

  describe('createShelf', () => {
    it('should throw BadRequestException if shelf code already exists', async () => {
      vi.mocked(mockShelfRepo.findByCode).mockResolvedValue({ id: 'shelf-1', code: 'RAF-A01' });

      await expect(
        useCase.createShelf('t-1', {
          name: 'Raf A',
          code: 'RAF-A01',
          rows: 3,
          columns: 3,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create shelf with cells when code is unique', async () => {
      vi.mocked(mockShelfRepo.findByCode).mockResolvedValue(null);
      vi.mocked(mockShelfRepo.createShelfWithCells).mockResolvedValue({
        id: 'shelf-1',
        code: 'RAF-A01',
        name: 'Raf A',
        totalCells: 9,
      });

      const result = await useCase.createShelf('t-1', {
        name: 'Raf A',
        code: 'RAF-A01',
        rows: 3,
        columns: 3,
      });

      expect(result.id).toBe('shelf-1');
      expect(mockShelfRepo.createShelfWithCells).toHaveBeenCalledWith('t-1', {
        name: 'Raf A',
        code: 'RAF-A01',
        zone: null,
        rows: 3,
        columns: 3,
        description: null,
      });
    });
  });

  describe('getShelves', () => {
    it('should return list of shelves with statistics', async () => {
      vi.mocked(mockShelfRepo.findAllWithStats).mockResolvedValue([
        { id: 'shelf-1', code: 'RAF-A01', totalCells: 9, occupiedCells: 2 },
      ]);

      const result = await useCase.getShelves('t-1');
      expect(result).toHaveLength(1);
      expect(mockShelfRepo.findAllWithStats).toHaveBeenCalledWith('t-1');
    });
  });

  describe('getShelfWithMatrix', () => {
    it('should throw NotFoundException if shelf does not exist', async () => {
      vi.mocked(mockShelfRepo.findByIdWithMatrix).mockResolvedValue(null);

      await expect(useCase.getShelfWithMatrix('t-1', 'invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should return shelf with matrix if found', async () => {
      const mockShelf = { id: 'shelf-1', code: 'RAF-A01', cells: [] };
      vi.mocked(mockShelfRepo.findByIdWithMatrix).mockResolvedValue(mockShelf);

      const result = await useCase.getShelfWithMatrix('t-1', 'shelf-1');
      expect(result).toEqual(mockShelf);
    });
  });

  describe('assignProductToCell', () => {
    it('should throw NotFoundException if product is not found', async () => {
      vi.mocked(mockShelfRepo.findProduct).mockResolvedValue(null);

      await expect(useCase.assignProductToCell('t-1', 'prod-1', 'cell-1')).rejects.toThrow(NotFoundException);
    });

    it('should unassign product if shelfCellId is null', async () => {
      vi.mocked(mockShelfRepo.findProduct).mockResolvedValue({ id: 'prod-1', tenantId: 't-1' });
      vi.mocked(mockShelfRepo.updateProductLocation).mockResolvedValue({ id: 'prod-1', shelfCellId: null });

      const result = await useCase.assignProductToCell('t-1', 'prod-1', null);
      expect(result.success).toBe(true);
      expect(mockShelfRepo.updateProductLocation).toHaveBeenCalledWith('prod-1', {
        shelfCellId: null,
        shelfId: null,
        shelfLocation: '',
        aisle: null,
        rack: null,
        tier: null,
        bin: null,
      });
    });
  });

  describe('deleteShelf', () => {
    it('should throw NotFoundException if shelf is not found', async () => {
      vi.mocked(mockShelfRepo.findShelfById).mockResolvedValue(null);

      await expect(useCase.deleteShelf('t-1', 'shelf-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if shelf has assigned products', async () => {
      vi.mocked(mockShelfRepo.findShelfById).mockResolvedValue({
        id: 'shelf-1',
        cells: [{ _count: { products: 3 } }],
      });

      await expect(useCase.deleteShelf('t-1', 'shelf-1')).rejects.toThrow(BadRequestException);
    });

    it('should delete shelf if empty', async () => {
      vi.mocked(mockShelfRepo.findShelfById).mockResolvedValue({
        id: 'shelf-1',
        cells: [{ _count: { products: 0 } }],
      });
      vi.mocked(mockShelfRepo.deleteShelf).mockResolvedValue(undefined);

      const result = await useCase.deleteShelf('t-1', 'shelf-1');
      expect(result.success).toBe(true);
      expect(mockShelfRepo.deleteShelf).toHaveBeenCalledWith('shelf-1');
    });
  });
});
