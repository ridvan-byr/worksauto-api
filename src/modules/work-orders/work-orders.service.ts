import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { WorkOrderStatus, WorkOrderItemType, WorkOrderPhotoType } from '@prisma/client';

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

  async create(tenantId: string, dto: CreateWorkOrderDto, author: string) {
    // Generate sequential work order number
    const count = await this.prisma.workOrder.count({ where: { tenantId } });
    const woNumber = `WO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.$transaction(async (tx) => {
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
              itemType: item.itemType,
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
  }

  async updateStatus(tenantId: string, id: string, newStatus: WorkOrderStatus) {
    const wo = await this.findOne(tenantId, id);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: newStatus,
        completedAt: newStatus === WorkOrderStatus.COMPLETED ? new Date() : undefined,
      },
    });
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

    return this.prisma.workOrder.update({
      where: { id },
      data: { status: prevStatus, completedAt: null },
    });
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
}
