import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { UserRole } from '@prisma/client';

@Injectable()
export class DeleteWorkOrderNoteUseCase {
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
    user: { id: string; name: string; surname?: string; role?: string },
  ) {
    const note = await this.workOrderRepository.findNoteById(tenantId, noteId);
    if (!note || note.workOrderId !== workOrderId) {
      throw new NotFoundException('Not bulunamadı.');
    }

    const fullName = `${user.name || ''} ${user.surname || ''}`.trim();
    const isAuthor = note.authorId
      ? note.authorId === user.id
      : note.authorName === fullName;
    const isManager =
      user.role === UserRole.OWNER || user.role === UserRole.SERVICE_MANAGER;

    if (!isAuthor && !isManager) {
      throw new ForbiddenException(
        'Bu mesajı silme yetkiniz bulunmamaktadır. Yalnızca kendi mesajlarınızı veya yönetici iseniz silebilirsiniz.',
      );
    }

    await this.workOrderRepository.deleteNote(tenantId, workOrderId, noteId);

    try {
      await this.auditService.log({
        tenantId,
        userId: user.id,
        action: 'DELETE_WORK_ORDER_NOTE',
        entityName: 'WorkOrder',
        entityId: workOrderId,
        changesBefore: {
          noteId,
          authorName: note.authorName,
          text: note.text,
          deletedBy: fullName,
          isManagerAction: !isAuthor && isManager,
        },
      });
    } catch {
      // Audit non-fatal
    }

    this.eventsGateway.emitToTenant(tenantId, 'workOrderNoteDeleted', {
      workOrderId,
      noteId,
    });

    return { success: true, id: noteId };
  }
}
