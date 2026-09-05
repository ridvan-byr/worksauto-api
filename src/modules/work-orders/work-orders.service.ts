import { InvoicesService } from '../invoices/invoices.service';
import { AuditService } from '../audit/audit.service';
import { AddWorkOrderItemDto } from './dto/add-item.dto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueService } from '../queues/queue.service';
import { WorkOrderStatus, WorkOrderItemType, WorkOrderPhotoType, StockMovementType, NotificationType } from '@prisma/client';

export interface CreateWorkOrderDto {
  appointmentId?: string;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  initialKm: number;
  fuelLevel?: string;
  items?: Array<{
    itemType: WorkOrderItemType;
    itemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    kdvRate?: number;
  }>;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly invoicesService: InvoicesService,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  async findAll(tenantId: string, status?: WorkOrderStatus) {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        customer: true,
        vehicle: true,
        assignedMechanic: { include: { user: true } },
        items: true,
        photos: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        vehicle: true,
        assignedMechanic: { include: { user: true } },
        items: true,
        photos: true,
        notes: { orderBy: { createdAt: 'desc' } },
        invoice: true,
      },
    });
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');
    return wo;
  }

  async create(tenantId: string, dto: CreateWorkOrderDto, author: string, actorUserId?: string) {
    // Generate sequential work order number
    const count = await this.prisma.workOrder.count({ where: { tenantId } });
    const woNumber = `WO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const createdWorkOrder = await this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let kdvTotal = 0;

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          const lineTotal = item.quantity * item.unitPrice;
          const kdv = lineTotal * ((item.kdvRate || 20) / 100);
          subtotal += lineTotal;
          kdvTotal += kdv;
        }
      }

      const grandTotal = subtotal + kdvTotal;

      const workOrder = await tx.workOrder.create({
        data: {
          tenantId,
          workOrderNumber: woNumber,
          appointmentId: dto.appointmentId,
          customerId: dto.customerId,
          vehicleId: dto.vehicleId,
          assignedMechanicId: dto.assignedMechanicId,
          assignedLift: dto.assignedLift,
          initialKm: dto.initialKm,
          fuelLevel: dto.fuelLevel,
          subtotal,
          kdvAmount: kdvTotal,
          grandTotal,
          status: WorkOrderStatus.QUEUE,
        },
      });

      // Update vehicle km
      await tx.vehicle.update({
        where: { id: dto.vehicleId },
        data: { currentKm: dto.initialKm },
      });

      // Insert items and conditionally decrement stock for PART items
      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          const lineTotal = item.quantity * item.unitPrice;
          await tx.workOrderItem.create({
            data: {
              workOrderId: workOrder.id,
              itemType: item.itemType || (item as any).type || WorkOrderItemType.SERVICE,
              itemId: item.itemId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              kdvRate: item.kdvRate || 20,
              totalPrice: lineTotal,
            },
          });

          if (item.itemType === WorkOrderItemType.PART && item.itemId) {
            await this.inventoryService.decrementStockAtomic(
              tenantId,
              item.itemId,
              item.quantity,
              woNumber,
              author,
            );
          }
        }
      }

      return workOrder;
    });

    // Emit WebSocket live event & create in-app notification
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { plate: true, brand: true, model: true },
    });

    this.eventsGateway.emitToTenant(tenantId, 'work_order:created', {
      ...createdWorkOrder,
      vehicle,
    });

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId,
      type: NotificationType.INFO,
      category: 'WORK_ORDER',
      title: 'Yeni İş Emri Açıldı',
      message: `${woNumber} nolu iş emri kabul edildi. Araç: ${vehicle?.plate || 'Belirtilmedi'}`,
      link: `/work-orders/${createdWorkOrder.id}`,
      metadata: { workOrderId: createdWorkOrder.id, workOrderNumber: woNumber, plate: vehicle?.plate },
    });

    return createdWorkOrder;
  }

  async updateStatus(tenantId: string, id: string, newStatus: WorkOrderStatus, userId?: string) {
    const statusToSave = (newStatus as any) === 'PENDING' ? WorkOrderStatus.QUEUE : newStatus;
    const wo = await this.findOne(tenantId, id);

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: statusToSave,
        completedAt: statusToSave === WorkOrderStatus.COMPLETED ? new Date() : undefined,
      },
      include: { items: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'work_order.status_changed',
      entityName: 'WorkOrder',
      entityId: id,
      changesBefore: {
        workOrderNumber: wo.workOrderNumber,
        status: wo.status,
        plate: wo.vehicle?.plate || 'Plaka Belirtilmedi',
        customerName: `${wo.customer?.firstName || ''} ${wo.customer?.lastName || ''}`.trim() || 'Müşteri Belirtilmedi',
      },
      changesAfter: {
        workOrderNumber: wo.workOrderNumber,
        status: newStatus,
        plate: wo.vehicle?.plate || 'Plaka Belirtilmedi',
        customerName: `${wo.customer?.firstName || ''} ${wo.customer?.lastName || ''}`.trim() || 'Müşteri Belirtilmedi',
      },
    });

    // STOCK ROLLBACK RULE: If work order is cancelled, restore reserved parts back to inventory
    if (statusToSave === WorkOrderStatus.CANCELLED && wo.status !== WorkOrderStatus.CANCELLED) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of wo.items) {
          if (item.itemType === WorkOrderItemType.PART && item.itemId) {
            await tx.product.update({
              where: { id: item.itemId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.itemId,
                movementType: StockMovementType.RETURN,
                quantity: item.quantity,
                referenceId: id,
                note: `İş emri iptali nedeniyle stok iadesi (#${wo.workOrderNumber})`,
                createdBy: userId || 'SYSTEM',
              },
            });
          }
        }
      });
    }

    // AUTO-INVOICE RULE: If tenant configured autoInvoiceOnComplete, automatically create invoice
    if (newStatus === WorkOrderStatus.COMPLETED) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { autoInvoiceOnComplete: true },
      });

      if (tenant?.autoInvoiceOnComplete) {
        const existingInv = await this.prisma.invoice.findFirst({
          where: { tenantId, workOrderId: id },
        });

        if (!existingInv && Number(wo.grandTotal) > 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);

          const invoice = await this.invoicesService.create(tenantId, {
            workOrderId: id,
            customerId: wo.customerId,
            dueDate: dueDate.toISOString().split('T')[0],
            subtotal: Number(wo.subtotal),
            kdvAmount: Number(wo.kdvAmount),
            grandTotal: Number(wo.grandTotal),
          });

          await this.auditService.log({
            tenantId,
            userId,
            action: 'invoice.auto_created_on_wo_complete',
            entityName: 'Invoice',
            entityId: invoice.id,
            changesAfter: {
              workOrderId: id,
              invoiceNumber: invoice.invoiceNumber,
              grandTotal: invoice.grandTotal,
            },
          });
        }
      }
    }

    // Emit WebSocket live events & create in-app notification
    this.eventsGateway.emitToTenant(tenantId, 'work_order:status_changed', {
      workOrderId: id,
      status: newStatus,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
    });

    if (newStatus === WorkOrderStatus.COMPLETED) {
      this.eventsGateway.emitToTenant(tenantId, 'work_order:completed', {
        workOrderId: id,
        workOrderNumber: wo.workOrderNumber,
        plate: wo.vehicle?.plate,
      });

      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.SUCCESS,
        category: 'WORK_ORDER',
        title: 'İş Emri Tamamlandı',
        message: `${wo.workOrderNumber} nolu iş emri (${wo.vehicle?.plate || ''}) başarıyla tamamlandı.`,
        link: `/work-orders/${id}`,
        metadata: { workOrderId: id, workOrderNumber: wo.workOrderNumber },
        recipientPhone: wo.customer?.phone,
        sendSms: !!wo.customer?.phone,
        sendWhatsApp: !!wo.customer?.phone,
      });
    } else {
      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        type: NotificationType.INFO,
        category: 'WORK_ORDER',
        title: 'İş Emri Durumu Değişti',
        message: `${wo.workOrderNumber} (${wo.vehicle?.plate || ''}) durumu "${newStatus}" yapıldı.`,
        link: `/work-orders/${id}`,
        metadata: { workOrderId: id, workOrderNumber: wo.workOrderNumber, status: newStatus },
      });
    }

    return updated;
  }

  /**
   * ATOMIC ROLLBACK TO PREVIOUS STAGE
   */
  async rollbackStatus(tenantId: string, id: string) {
    const wo = await this.findOne(tenantId, id);

    let prevStatus: WorkOrderStatus = WorkOrderStatus.QUEUE;
    if (wo.status === WorkOrderStatus.COMPLETED) {
      prevStatus = WorkOrderStatus.IN_PROGRESS;
    } else if (wo.status === WorkOrderStatus.IN_PROGRESS) {
      prevStatus = WorkOrderStatus.QUEUE;
    } else {
      throw new BadRequestException('Kuyruktaki bir iş emri daha geri alınamaz.');
    }

    const rolledBack = await this.prisma.workOrder.update({
      where: { id },
      data: { status: prevStatus, completedAt: null },
    });

    this.eventsGateway.emitToTenant(tenantId, 'work_order:status_changed', {
      workOrderId: id,
      status: prevStatus,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
    });

    return rolledBack;
  }

  async addPhoto(tenantId: string, id: string, url: string, caption: string, photoType: WorkOrderPhotoType, uploadedBy: string) {
    await this.findOne(tenantId, id);
    return this.prisma.workOrderPhoto.create({
      data: {
        workOrderId: id,
        url,
        caption,
        photoType,
        uploadedBy,
      },
    });
  }
  async addItem(tenantId: string, workOrderId: string, dto: AddWorkOrderItemDto, author: string) {
    const wo = await this.findOne(tenantId, workOrderId);
    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('Tamamlanmış veya iptal edilmiş iş emrine yeni kalem eklenemez.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. If PART, atomically check and deduct stock
      if (dto.itemType === WorkOrderItemType.PART && dto.itemId) {
        const product = await tx.product.findFirst({
          where: { id: dto.itemId, tenantId },
        });

        if (!product) {
          throw new NotFoundException('Belirtilen yedek parça depoda bulunamadı.');
        }

        if (product.stockQuantity < dto.quantity) {
          throw new BadRequestException(
            `Yetersiz stok! "${product.name}" için mevcut stok: ${product.stockQuantity}, talep edilen: ${dto.quantity}`,
          );
        }

        await tx.product.update({
          where: { id: dto.itemId },
          data: { stockQuantity: { decrement: dto.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: dto.itemId,
            movementType: StockMovementType.OUT_WORK_ORDER,
            quantity: dto.quantity,
            reason: `İş Emri Sarfiyatı: ${wo.workOrderNumber}`,
            referenceId: wo.id,
            createdBy: author,
          },
        });
      }

      // 2. Add WorkOrderItem
      const kdvRate = dto.kdvRate ?? 20;
      const basePrice = Number(dto.unitPrice) * Number(dto.quantity);
      const kdvAmount = (basePrice * kdvRate) / 100;
      const totalPrice = basePrice + kdvAmount;

      await tx.workOrderItem.create({
        data: {
          workOrderId: wo.id,
          itemType: dto.itemType,
          itemId: dto.itemId || null,
          name: dto.name,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          kdvRate,
          totalPrice,
        },
      });

      // 3. Recalculate totals
      const allItems = await tx.workOrderItem.findMany({
        where: { workOrderId: wo.id },
      });

      let newSubtotal = 0;
      let newKdvTotal = 0;

      for (const item of allItems) {
        const itemBase = Number(item.unitPrice) * item.quantity;
        const itemKdv = (itemBase * Number(item.kdvRate)) / 100;
        newSubtotal += itemBase;
        newKdvTotal += itemKdv;
      }

      const newGrandTotal = newSubtotal + newKdvTotal;

      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          subtotal: newSubtotal,
          kdvAmount: newKdvTotal,
          grandTotal: newGrandTotal,
        },
      });

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

      return tx.workOrder.findUnique({
        where: { id: wo.id },
        include: {
          customer: true,
          vehicle: true,
          assignedMechanic: { include: { user: true } },
          items: true,
          photos: true,
        },
      });
    });

    this.eventsGateway.emitToTenant(tenantId, 'work_order:item_added', {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
      item: dto.name,
    });

    return result;
  }

  async removeItem(tenantId: string, workOrderId: string, itemId: string, author: string) {
    const wo = await this.findOne(tenantId, workOrderId);
    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException('Tamamlanmış veya iptal edilmiş iş emrinden kalem silinemez.');
    }

    const item = await this.prisma.workOrderItem.findFirst({
      where: { id: itemId, workOrderId },
    });

    if (!item) {
      throw new NotFoundException('İş emri kalemi bulunamadı.');
    }

    const updatedWo = await this.prisma.$transaction(async (tx) => {
      if (item.itemType === WorkOrderItemType.PART && item.itemId) {
        await tx.product.update({
          where: { id: item.itemId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.itemId,
            movementType: StockMovementType.RETURN,
            quantity: item.quantity,
            reason: `İş Emrinden İade: ${wo.workOrderNumber}`,
            referenceId: wo.id,
            createdBy: author,
          },
        });
      }

      await tx.workOrderItem.delete({
        where: { id: itemId },
      });

      const remainingItems = await tx.workOrderItem.findMany({
        where: { workOrderId: wo.id },
      });

      let newSubtotal = 0;
      let newKdvTotal = 0;

      for (const it of remainingItems) {
        const itemBase = Number(it.unitPrice) * it.quantity;
        const itemKdv = (itemBase * Number(it.kdvRate)) / 100;
        newSubtotal += itemBase;
        newKdvTotal += itemKdv;
      }

      const newGrandTotal = newSubtotal + newKdvTotal;

      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          subtotal: newSubtotal,
          kdvAmount: newKdvTotal,
          grandTotal: newGrandTotal,
        },
      });

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

      return tx.workOrder.findUnique({
        where: { id: wo.id },
        include: {
          customer: true,
          vehicle: true,
          assignedMechanic: { include: { user: true } },
          items: true,
          photos: true,
        },
      });
    });

    this.eventsGateway.emitToTenant(tenantId, 'work_order:item_removed', {
      workOrderId: wo.id,
      workOrderNumber: wo.workOrderNumber,
      plate: wo.vehicle?.plate,
      item: item.name,
    });

    return updatedWo;
  }
}