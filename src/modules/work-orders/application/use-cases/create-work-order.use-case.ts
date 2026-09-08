import { Injectable, Inject } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

export interface CreateWorkOrderInput {
  appointmentId?: string;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  initialKm: number;
  fuelLevel?: string;
  items?: Array<{
    itemType: 'PART' | 'SERVICE';
    itemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    kdvRate?: number;
  }>;
}

@Injectable()
export class CreateWorkOrderUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(tenantId: string, input: CreateWorkOrderInput, author: string, actorUserId?: string) {
    const woNumber = await this.workOrderRepository.getNextWorkOrderNumber(tenantId);

    let subtotal = 0;
    let kdvTotal = 0;
    const formattedItems = [];

    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        const lineTotal = item.quantity * item.unitPrice;
        const kdv = lineTotal * ((item.kdvRate ?? 20) / 100);
        subtotal += lineTotal;
        kdvTotal += kdv;

        formattedItems.push({
          itemType: item.itemType || 'SERVICE',
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          kdvRate: item.kdvRate ?? 20,
          totalPrice: lineTotal,
        });
      }
    }

    const grandTotal = subtotal + kdvTotal;

    const createdWorkOrder = await this.workOrderRepository.create({
      tenantId,
      workOrderNumber: woNumber,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      assignedMechanicId: input.assignedMechanicId,
      assignedLift: input.assignedLift,
      initialKm: input.initialKm,
      fuelLevel: input.fuelLevel,
      subtotal,
      kdvAmount: kdvTotal,
      grandTotal,
      status: WorkOrderStatusEnum.QUEUE,
      author,
      items: formattedItems,
    });

    // Notify & emit events
    this.eventsGateway.emitToTenant(tenantId, 'work_order:created', {
      ...createdWorkOrder,
    });

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId,
      type: NotificationType.INFO,
      category: 'WORK_ORDER',
      title: 'Yeni İş Emri Açıldı',
      message: `${woNumber} nolu iş emri kabul edildi.`,
      link: `/work-orders/${createdWorkOrder.id}`,
      metadata: { workOrderId: createdWorkOrder.id, workOrderNumber: woNumber },
    });

    return createdWorkOrder;
  }
}
