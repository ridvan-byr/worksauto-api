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
import { AddWorkOrderItemDto } from '../../dto/add-item.dto';

@Injectable()
export class AddWorkOrderItemUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    workOrderId: string,
    dto: AddWorkOrderItemDto,
    author: string,
  ) {
    const wo = await this.workOrderRepository.findById(tenantId, workOrderId);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    const statusVO = new WorkOrderStatusVO(wo.status);
    if (statusVO.isCompleted() || statusVO.isCancelled()) {
      throw new BadRequestException(
        'Tamamlanmış veya iptal edilmiş iş emrine yeni kalem eklenemez.',
      );
    }

    const kdvRate = dto.kdvRate ?? 20;
    const basePrice = Number(dto.unitPrice) * Number(dto.quantity);
    const kdvAmount = (basePrice * kdvRate) / 100;
    const totalPrice = basePrice + kdvAmount;

    const result = await this.workOrderRepository.addItem(
      tenantId,
      workOrderId,
      {
        itemType: dto.itemType as any,
        itemId: dto.itemId || null,
        name: dto.name,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        kdvRate,
        totalPrice,
      },
      author,
    );

    try {
      await this.auditService.log({
        tenantId,
        action: 'work_order.item_added',
        entityName: 'WorkOrder',
        entityId: wo.id,
        changesAfter: {
          itemName: dto.name,
          itemType: dto.itemType,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          totalPrice,
          plate: wo.vehicle?.plate || 'Belirtilmedi',
          workOrderNumber: wo.workOrderNumber,
          author,
        },
      });
    } catch (err) {
      console.error('Audit log failed for work_order.item_added:', err);
    }

    this.eventsGateway.emitToTenant(tenantId, 'work_order:item_added', {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
      item: dto.name,
    });

    return result;
  }
}
