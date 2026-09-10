import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteWorkOrderNoteUseCase } from './delete-work-order-note.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('DeleteWorkOrderNoteUseCase', () => {
  let useCase: DeleteWorkOrderNoteUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: AuditService;
  let mockEvents: EventsGateway;

  beforeEach(() => {
    mockRepo = {
      findNoteById: vi.fn(),
      deleteNote: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    } as any;

    useCase = new DeleteWorkOrderNoteUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if note does not exist', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'wo-1', 'n-1', { id: 'u-1', name: 'Ali' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not author nor manager', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-99',
      authorName: 'Baska Usta',
    });

    await expect(
      useCase.execute('t-1', 'wo-1', 'n-1', { id: 'u-1', name: 'Ali', role: UserRole.TECHNICIAN }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow note author to delete their note', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-1',
      authorName: 'Ali Yılmaz',
    });
    mockRepo.deleteNote = vi.fn().mockResolvedValue(undefined);

    const result = await useCase.execute('t-1', 'wo-1', 'n-1', {
      id: 'u-1',
      name: 'Ali',
      surname: 'Yılmaz',
      role: UserRole.TECHNICIAN,
    });

    expect(result).toEqual({ success: true, id: 'n-1' });
    expect(mockRepo.deleteNote).toHaveBeenCalledWith('t-1', 'wo-1', 'n-1');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith('t-1', 'workOrderNoteDeleted', {
      workOrderId: 'wo-1',
      noteId: 'n-1',
    });
  });

  it('should allow manager (OWNER) to delete any note', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-99',
      authorName: 'Baska Usta',
    });
    mockRepo.deleteNote = vi.fn().mockResolvedValue(undefined);

    const result = await useCase.execute('t-1', 'wo-1', 'n-1', {
      id: 'admin-1',
      name: 'Yonetici',
      role: UserRole.OWNER,
    });

    expect(result).toEqual({ success: true, id: 'n-1' });
    expect(mockRepo.deleteNote).toHaveBeenCalledWith('t-1', 'wo-1', 'n-1');
  });
});
