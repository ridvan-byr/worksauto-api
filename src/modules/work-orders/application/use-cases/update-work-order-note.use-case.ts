import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { UpdateWorkOrderNoteDto } from '../../dto/update-note.dto';

@Injectable()
export class UpdateWorkOrderNoteUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    workOrderId: string,
    noteId: string,
    dto: UpdateWorkOrderNoteDto,
    authorUser: { id: string; name: string; surname?: string },
  ) {
    const note = await this.workOrderRepository.findNoteById(tenantId, noteId);
    if (!note || note.workOrderId !== workOrderId) {
      throw new NotFoundException('Not bulunamadı.');
    }

    const fullName = `${authorUser.name || ''} ${authorUser.surname || ''}`.trim();
    const isOwner = note.authorId ? note.authorId === authorUser.id : note.authorName === fullName;
    if (!isOwner) {
      throw new ForbiddenException('Yalnızca kendi mesajlarınızı düzenleyebilirsiniz.');
    }

    const updatedNote = await this.workOrderRepository.updateNote(
      tenantId,
      workOrderId,
      noteId,
      dto.text.trim(),
    );

    try {
      await this.auditService.log({
        tenantId,
        userId: authorUser.id,
        action: 'UPDATE_WORK_ORDER_NOTE',
        entityName: 'WorkOrder',
        entityId: workOrderId,
        changesBefore: { noteId, text: note.text },
        changesAfter: { noteId, authorName: fullName, text: dto.text },
      });
    } catch {
      // Audit non-fatal
    }

    this.eventsGateway.emitToTenant(tenantId, 'workOrderNoteUpdated', {
      workOrderId,
      note: updatedNote,
    });

    return updatedNote;
  }
}
