import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import {
  WorkOrderStatusVO,
  WorkOrderStatusEnum,
} from '../../domain/value-objects/work-order-status.vo';
import { EventsGateway } from '../../../events/events.gateway';

@Injectable()
export class RollbackWorkOrderUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(tenantId: string, id: string) {
    const wo = await this.workOrderRepository.findById(tenantId, id);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    let prevStatus: WorkOrderStatusEnum;
    try {
      const statusVO = new WorkOrderStatusVO(wo.status);
      prevStatus = statusVO.getPreviousStatus();
    } catch (err: any) {
      throw new BadRequestException(
        err.message || 'Kuyruktaki bir iş emri daha geri alınamaz.',
      );
    }

    const rolledBack = await this.workOrderRepository.rollbackStatus(
      tenantId,
      id,
      prevStatus,
    );

    this.eventsGateway.emitToTenant(tenantId, 'work_order:status_changed', {
      workOrderId: id,
      status: prevStatus,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
    });

    return rolledBack;
  }
}
