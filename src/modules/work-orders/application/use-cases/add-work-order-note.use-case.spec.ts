import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddWorkOrderNoteUseCase } from './add-work-order-note.use-case';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';

describe('AddWorkOrderNoteUseCase', () => {
  let useCase: AddWorkOrderNoteUseCase;
  let mockRepo: IWorkOrderRepository;
  let mockAudit: AuditService;
  let mockEvents: EventsGateway;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      addNote: vi.fn(),
    } as any;

    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockEvents = {
      emitToTenant: vi.fn(),
    } as any;

    useCase = new AddWorkOrderNoteUseCase(mockRepo, mockAudit, mockEvents);
  });

  it('should throw NotFoundException if work order does not exist', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute(
        't-1',
        'wo-1',
        { text: 'Test not' },
        { id: 'u-1', name: 'Ali' },
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if work order is cancelled', async () => {
    mockRepo.findById = vi
      .fn()
      .mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.CANCELLED });

    await expect(
      useCase.execute(
        't-1',
        'wo-1',
        { text: 'Test not' },
        { id: 'u-1', name: 'Ali' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should successfully add note and emit event', async () => {
    mockRepo.findById = vi
      .fn()
      .mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS });
    mockRepo.addNote = vi.fn().mockResolvedValue({
      id: 'note-1',
      authorId: 'u-1',
      authorName: 'Ali Yılmaz',
      text: 'Test notu',
      isInternal: true,
    });

    const result = await useCase.execute(
      't-1',
      'wo-1',
      { text: 'Test notu' },
      { id: 'u-1', name: 'Ali', surname: 'Yılmaz' },
    );

    expect(result.id).toBe('note-1');
    expect(mockRepo.addNote).toHaveBeenCalledWith(
      't-1',
      'wo-1',
      'u-1',
      'Ali Yılmaz',
      'Test notu',
      true,
    );
    expect(mockEvents.emitToTenant).toHaveBeenCalledWith(
      't-1',
      'workOrderNoteAdded',
      {
        workOrderId: 'wo-1',
        note: result,
      },
    );
  });
});
