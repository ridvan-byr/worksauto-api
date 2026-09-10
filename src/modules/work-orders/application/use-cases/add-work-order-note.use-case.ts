import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderStatusVO } from '../../domain/value-objects/work-order-status.vo';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';
import { CreateWorkOrderNoteDto } from '../../dto/create-note.dto';

@Injectable()
export class AddWorkOrderNoteUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    workOrderId: string,
    dto: CreateWorkOrderNoteDto,
    authorUser: { id?: string; name: string; surname?: string },
  ) {
    const wo = await this.workOrderRepository.findById(tenantId, workOrderId);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    const statusVO = new WorkOrderStatusVO(wo.status);
    if (statusVO.isCancelled()) {
      throw new BadRequestException('İptal edilmiş iş emrine not eklenemez.');
    }

    const fullName = `${authorUser.name || 'Personel'} ${authorUser.surname || ''}`.trim();
    const note = await this.workOrderRepository.addNote(
      tenantId,
      workOrderId,
      authorUser.id || null,
      fullName,
      dto.text.trim(),
      dto.isInternal ?? true,
    );

    try {
      await this.auditService.log({
        tenantId,
        userId: authorUser.id,
        action: 'ADD_WORK_ORDER_NOTE',
        entityName: 'WorkOrder',
        entityId: workOrderId,
        changesAfter: { noteId: note.id, authorName: fullName, text: dto.text },
      });
    } catch {
      // Audit non-fatal
    }

    this.eventsGateway.emitToTenant(tenantId, 'workOrderNoteAdded', {
      workOrderId,
      note,
    });

    return note;
  }
}
