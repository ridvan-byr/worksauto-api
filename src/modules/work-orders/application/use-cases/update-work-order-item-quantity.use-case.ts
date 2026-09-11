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
import { UpdateWorkOrderItemDto } from '../../dto/update-item.dto';

@Injectable()
export class UpdateWorkOrderItemQuantityUseCase {
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
    dto: UpdateWorkOrderItemDto,
    author: string,
  ) {
    const wo = await this.workOrderRepository.findById(tenantId, workOrderId);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    const statusVO = new WorkOrderStatusVO(wo.status);
    if (statusVO.isCompleted() || statusVO.isCancelled()) {
      throw new BadRequestException(
        'Tamamlanmış veya iptal edilmiş iş emrinde kalem güncellenemez.',
      );
    }

    const item = (wo.items || []).find((it: any) => it.id === itemId);
    if (!item) {
      throw new NotFoundException('İş emri kalemi bulunamadı.');
    }

    const updated = await this.workOrderRepository.updateItem(
      tenantId,
      workOrderId,
      itemId,
      dto,
      author,
    );

    const oldQty = item.quantity;
    const newQty = dto.quantity ?? oldQty;
    const diff = newQty - oldQty;
    const isPart = item.itemType === 'PART';
    const stockActionText = isPart
      ? diff > 0
        ? `Stoktan ${diff} adet düşüldü`
        : `Stoğa ${Math.abs(diff)} adet iade edildi`
      : 'İşçilik güncellendi';

    try {
      await this.auditService.log({
        tenantId,
        action: 'work_order.item_quantity_updated',
        entityName: 'WorkOrder',
        entityId: wo.id,
        changesBefore: {
          itemName: item.name,
          itemType: item.itemType,
          quantity: oldQty,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          plate: wo.vehicle?.plate || 'Belirtilmedi',
          workOrderNumber: wo.workOrderNumber,
          author,
        },
        changesAfter: {
          itemName: item.name,
          itemType: item.itemType,
          oldQuantity: oldQty,
          quantity: newQty,
          quantityChange: diff > 0 ? `+${diff}` : `${diff}`,
          stockMovement: stockActionText,
          unitPrice: Number(item.unitPrice),
          totalPrice:
            updated?.items?.find((i: any) => i.id === itemId)?.totalPrice ||
            Number(item.unitPrice) * newQty,
          plate: wo.vehicle?.plate || 'Belirtilmedi',
          workOrderNumber: wo.workOrderNumber,
          author,
        },
      });
    } catch (err) {
      console.error(
        'Audit log failed for work_order.item_quantity_updated:',
        err,
      );
    }

    this.eventsGateway.emitToTenant(tenantId, 'work_order:item_updated', {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
      item: item.name,
      oldQuantity: item.quantity,
      newQuantity: dto.quantity,
    });

    return updated;
  }
}
