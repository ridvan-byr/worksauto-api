import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderStatusVO } from '../../domain/value-objects/work-order-status.vo';
import { AuditService } from '../../../audit/audit.service';
import { EventsGateway } from '../../../events/events.gateway';

@Injectable()
export class RemoveWorkOrderItemUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    workOrderId: string,
    itemId: string,
    author: string,
  ) {
    const wo = await this.workOrderRepository.findById(tenantId, workOrderId);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    const statusVO = new WorkOrderStatusVO(wo.status);
    if (statusVO.isCompleted() || statusVO.isCancelled()) {
      throw new BadRequestException(
        'Tamamlanmış veya iptal edilmiş iş emrinden kalem silinemez.',
      );
    }

    const item = (wo.items || []).find((it: any) => it.id === itemId);
    if (!item) {
      throw new NotFoundException('İş emri kalemi bulunamadı.');
    }

    const updated = await this.workOrderRepository.removeItem(
      tenantId,
      workOrderId,
      itemId,
      author,
    );

    try {
      await this.auditService.log({
        tenantId,
        action: 'work_order.item_removed',
        entityName: 'WorkOrder',
        entityId: wo.id,
        changesBefore: {
          itemName: item.name,
          itemType: item.itemType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          plate: wo.vehicle?.plate || 'Belirtilmedi',
          workOrderNumber: wo.workOrderNumber,
          author,
        },
      });
    } catch (err) {
      console.error('Audit log failed for work_order.item_removed:', err);
    }

    this.eventsGateway.emitToTenant(tenantId, 'work_order:item_removed', {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
      item: item.name,
    });

    return updated;
  }
}
