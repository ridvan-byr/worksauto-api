import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateWorkOrderNoteUseCase } from './update-work-order-note.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('UpdateWorkOrderNoteUseCase', () => {
  let useCase: UpdateWorkOrderNoteUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: AuditService;
  let mockEvents: EventsGateway;

  beforeEach(() => {
    mockRepo = {
      findNoteById: vi.fn(),
      updateNote: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    } as any;

    useCase = new UpdateWorkOrderNoteUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if note is missing or belongs to another work order', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute('t-1', 'wo-1', 'n-1', { text: 'Güncellendi' }, { id: 'u-1', name: 'Ali' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not the author of note', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-99',
      authorName: 'Baska Usta',
      text: 'Orijinal',
    });

    await expect(
      useCase.execute('t-1', 'wo-1', 'n-1', { text: 'Güncellendi' }, { id: 'u-1', name: 'Ali' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should successfully update note if user is author', async () => {
    mockRepo.findNoteById = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-1',
      authorName: 'Ali Yılmaz',
      text: 'Eski metin',
    });
    mockRepo.updateNote = vi.fn().mockResolvedValue({
      id: 'n-1',
      workOrderId: 'wo-1',
      authorId: 'u-1',
      authorName: 'Ali Yılmaz',
      text: 'Yeni metin',
    });

    const result = await useCase.execute(
      't-1',
      'wo-1',
      'n-1',
      { text: 'Yeni metin' },
      { id: 'u-1', name: 'Ali', surname: 'Yılmaz' },
    );

    expect(result.text).toBe('Yeni metin');
    expect(mockRepo.updateNote).toHaveBeenCalledWith('t-1', 'wo-1', 'n-1', 'Yeni metin');
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith('t-1', 'workOrderNoteUpdated', {
      workOrderId: 'wo-1',
      note: result,
    });
  });
});
