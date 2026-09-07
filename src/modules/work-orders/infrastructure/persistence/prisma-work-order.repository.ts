import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IWorkOrderRepository, CreateWorkOrderData } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderStatus, WorkOrderItemType, WorkOrderPhotoType, StockMovementType } from '@prisma/client';

@Injectable()
export class PrismaWorkOrderRepository implements IWorkOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, status?: string): Promise<any[]> {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as WorkOrderStatus } : {}),
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

  async findById(tenantId: string, id: string): Promise<any | null> {
    return this.prisma.workOrder.findFirst({
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
  }

  async getNextWorkOrderNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.workOrder.count({ where: { tenantId } });
    return `WO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(data: CreateWorkOrderData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          tenantId: data.tenantId,
          workOrderNumber: data.workOrderNumber,
          appointmentId: data.appointmentId,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          assignedMechanicId: data.assignedMechanicId,
          assignedLift: data.assignedLift,
          initialKm: data.initialKm,
          fuelLevel: data.fuelLevel,
          subtotal: data.subtotal,
          kdvAmount: data.kdvAmount,
          grandTotal: data.grandTotal,
          status: data.status as WorkOrderStatus,
        },
      });

      // Update vehicle current km
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: { currentKm: data.initialKm },
      });

      // Insert line items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await tx.workOrderItem.create({
            data: {
              workOrderId: workOrder.id,
              itemType: item.itemType as WorkOrderItemType,
              itemId: item.itemId || null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              kdvRate: item.kdvRate || 20,
              totalPrice: item.totalPrice,
            },
          });
        }
      }

      return workOrder;
    });
  }

  async updateStatus(tenantId: string, id: string, status: string, completedAt?: Date | null): Promise<any> {
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: status as WorkOrderStatus,
        completedAt: completedAt !== undefined ? completedAt : undefined,
      },
      include: { items: true },
    });
  }

  async rollbackStatus(tenantId: string, id: string, prevStatus: string): Promise<any> {
    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status: prevStatus as WorkOrderStatus,
        completedAt: null,
      },
    });
  }

  async addItem(
    tenantId: string,
    workOrderId: string,
    item: {
      itemType: 'PART' | 'SERVICE';
      itemId?: string | null;
      name: string;
      quantity: number;
      unitPrice: number;
      kdvRate: number;
      totalPrice: number;
    },
    author: string,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findFirst({
        where: { id: workOrderId, tenantId },
      });
      if (!wo) throw new NotFoundException('İş emri bulunamadı.');

      // 1. If PART, atomically check and deduct stock
      if (item.itemType === 'PART' && item.itemId) {
        const product = await tx.product.findFirst({
          where: { id: item.itemId, tenantId },
        });

        if (!product) {
          throw new NotFoundException('Belirtilen yedek parça depoda bulunamadı.');
        }

        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Yetersiz stok! "${product.name}" için mevcut stok: ${product.stockQuantity}, talep edilen: ${item.quantity}`,
          );
        }

        await tx.product.update({
          where: { id: item.itemId },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.itemId,
            movementType: StockMovementType.OUT_WORK_ORDER,
            quantity: item.quantity,
            note: `İş Emri Sarfiyatı: ${wo.workOrderNumber}`,
            referenceId: wo.id,
            createdBy: author,
          },
        });
      }

      // 2. Add WorkOrderItem
      await tx.workOrderItem.create({
        data: {
          workOrderId: wo.id,
          itemType: item.itemType as WorkOrderItemType,
          itemId: item.itemId || null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          kdvRate: item.kdvRate,
          totalPrice: item.totalPrice,
        },
      });

      // 3. Recalculate totals
      const allItems = await tx.workOrderItem.findMany({
        where: { workOrderId: wo.id },
      });

      let newSubtotal = 0;
      let newKdvTotal = 0;

      for (const it of allItems) {
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
  }

  async removeItem(tenantId: string, workOrderId: string, itemId: string, author: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findFirst({
        where: { id: workOrderId, tenantId },
      });
      if (!wo) throw new NotFoundException('İş emri bulunamadı.');

      const item = await tx.workOrderItem.findFirst({
        where: { id: itemId, workOrderId },
      });
      if (!item) throw new NotFoundException('İş emri kalemi bulunamadı.');

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
            note: `İş Emrinden İade: ${wo.workOrderNumber}`,
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
  }

  async addPhoto(tenantId: string, id: string, url: string, caption: string, photoType: string, uploadedBy: string): Promise<any> {
    return this.prisma.workOrderPhoto.create({
      data: {
        workOrderId: id,
        url,
        caption,
        photoType: photoType as WorkOrderPhotoType,
        uploadedBy,
      },
    });
  }

  async restoreCancelledStock(tenantId: string, workOrderId: string, userId?: string): Promise<void> {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { items: true },
    });
    if (!wo) return;

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
              referenceId: workOrderId,
              note: `İş emri iptali nedeniyle stok iadesi (#${wo.workOrderNumber})`,
              createdBy: userId || 'SYSTEM',
            },
          });
        }
      }
    });
  }

  async getTenantAutoInvoiceConfig(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { autoInvoiceOnComplete: true },
    });
    return !!tenant?.autoInvoiceOnComplete;
  }

  async findInvoiceByWorkOrder(tenantId: string, workOrderId: string): Promise<any | null> {
    return this.prisma.invoice.findFirst({
      where: { tenantId, workOrderId },
    });
  }
}
