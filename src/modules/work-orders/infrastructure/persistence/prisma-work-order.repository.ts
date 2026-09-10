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
    const year = new Date().getFullYear();
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        tenantId_docType_year: {
          tenantId,
          docType: 'WORK_ORDER',
          year,
        },
      },
      create: {
        tenantId,
        docType: 'WORK_ORDER',
        year,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });

    return `WO-${year}-${String(sequence.lastNumber).padStart(5, '0')}`;
  }

  async create(data: CreateWorkOrderData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify customer strictly belongs to this tenant
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, tenantId: data.tenantId, deletedAt: null },
      });
      if (!customer) {
        throw new BadRequestException('Seçilen müşteri bulunamadı veya bu işletmeye ait değil.');
      }

      // 2. Verify vehicle strictly belongs to this tenant and customer
      const vehicle = await tx.vehicle.findFirst({
        where: { id: data.vehicleId, tenantId: data.tenantId, deletedAt: null },
      });
      if (!vehicle) {
        throw new BadRequestException('Seçilen araç bulunamadı veya bu işletmeye ait değil.');
      }
      if (vehicle.customerId !== data.customerId) {
        throw new BadRequestException('Seçilen araç ile müşteri eşleşmiyor.');
      }

      // 3. If mechanic assigned, verify mechanic belongs to this tenant
      if (data.assignedMechanicId) {
        const mechanic = await tx.mechanic.findFirst({
          where: { id: data.assignedMechanicId, tenantId: data.tenantId },
        });
        if (!mechanic) {
          throw new BadRequestException('Seçilen teknisyen bulunamadı veya bu işletmeye ait değil.');
        }
      }

      // 4. If appointment referenced, verify appointment belongs to this tenant
      if (data.appointmentId) {
        const appt = await tx.appointment.findFirst({
          where: { id: data.appointmentId, tenantId: data.tenantId },
        });
        if (!appt) {
          throw new BadRequestException('Seçilen randevu bulunamadı veya bu işletmeye ait değil.');
        }
      }

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

      // Insert line items & deduct stock atomically within the same transaction
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          if (item.itemType === 'PART' && item.itemId) {
            const updatedCount = await tx.$executeRaw`
              UPDATE products
              SET stock_quantity = stock_quantity - ${item.quantity}
              WHERE id = ${item.itemId}::uuid 
                AND tenant_id = ${data.tenantId}::uuid 
                AND stock_quantity >= ${item.quantity}
            `;

            if (updatedCount === 0) {
              const product = await tx.product.findFirst({
                where: { id: item.itemId, tenantId: data.tenantId },
              });

              if (!product) {
                throw new NotFoundException('Belirtilen yedek parça depoda bulunamadı.');
              }

              throw new BadRequestException(
                `Yetersiz stok! "${product.name}" için mevcut stok (${product.stockQuantity}) talep edilen miktarı (${item.quantity}) karşılamıyor.`,
              );
            }

            await tx.stockMovement.create({
              data: {
                tenantId: data.tenantId,
                productId: item.itemId,
                movementType: StockMovementType.OUT_WORK_ORDER,
                quantity: item.quantity,
                note: `İş Emri Sarfiyatı: ${data.workOrderNumber}`,
                referenceId: workOrder.id,
                createdBy: data.author || 'SYSTEM',
              },
            });
          }

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
    const existing = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('İş emri bulunamadı veya bu işletmeye ait değil.');
    }

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
    const existing = await this.prisma.workOrder.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('İş emri bulunamadı veya bu işletmeye ait değil.');
    }

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
        // Atomic SQL update guarantees no negative stock even under high concurrency
        const updatedCount = await tx.$executeRaw`
          UPDATE products
          SET stock_quantity = stock_quantity - ${item.quantity}
          WHERE id = ${item.itemId}::uuid 
            AND tenant_id = ${tenantId}::uuid 
            AND stock_quantity >= ${item.quantity}
        `;

        if (updatedCount === 0) {
          const product = await tx.product.findFirst({
            where: { id: item.itemId, tenantId },
          });

          if (!product) {
            throw new NotFoundException('Belirtilen yedek parça depoda bulunamadı.');
          }

          throw new BadRequestException(
            `Yetersiz stok! "${product.name}" için mevcut stok (${product.stockQuantity}) talep edilen miktarı (${item.quantity}) karşılamıyor.`,
          );
        }

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

  async updateItem(
    tenantId: string,
    workOrderId: string,
    itemId: string,
    data: { name?: string; unitPrice?: number; quantity?: number },
    author: string,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findFirst({
        where: { id: workOrderId, tenantId },
      });
      if (!wo) throw new NotFoundException('İş emri bulunamadı.');

      const item = await tx.workOrderItem.findFirst({
        where: { id: itemId, workOrderId },
      });
      if (!item) throw new NotFoundException('İş emri kalemi bulunamadı.');

      let newQuantity = item.quantity;
      if (data.quantity !== undefined) {
        if (data.quantity <= 0) {
          throw new BadRequestException('Kalem adedi en az 1 olmalıdır.');
        }
        newQuantity = data.quantity;
      }

      const diff = newQuantity - item.quantity;

      if (diff !== 0 && item.itemType === WorkOrderItemType.PART && item.itemId) {
        if (diff > 0) {
          // Need more stock: atomic decrement
          const updatedCount = await tx.$executeRaw`
            UPDATE products 
            SET stock_quantity = stock_quantity - ${diff} 
            WHERE id = ${item.itemId}::uuid 
              AND tenant_id = ${tenantId}::uuid 
              AND stock_quantity >= ${diff}
          `;

          if (updatedCount === 0) {
            const product = await tx.product.findFirst({
              where: { id: item.itemId, tenantId },
            });
            throw new BadRequestException(
              `Yetersiz stok! "${product?.name || 'Ürün'}" için mevcut stok (${product?.stockQuantity || 0}) eklenen ${diff} adedi karşılamıyor.`,
            );
          }

          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: item.itemId,
              movementType: StockMovementType.OUT_WORK_ORDER,
              quantity: diff,
              note: `İş Emri Sarfiyat Artışı (+${diff}): ${wo.workOrderNumber}`,
              referenceId: wo.id,
              createdBy: author,
            },
          });
        } else {
          // Decreasing quantity: return diff back to stock
          const returnQty = Math.abs(diff);
          await tx.product.update({
            where: { id: item.itemId },
            data: { stockQuantity: { increment: returnQty } },
          });

          await tx.stockMovement.create({
            data: {
              tenantId,
              productId: item.itemId,
              movementType: StockMovementType.RETURN,
              quantity: returnQty,
              note: `İş Emri Sarfiyat Azaltımı (-${returnQty}): ${wo.workOrderNumber}`,
              referenceId: wo.id,
              createdBy: author,
            },
          });
        }
      }

      const newName = data.name !== undefined ? data.name.trim() : item.name;
      const newUnitPrice = data.unitPrice !== undefined ? Number(data.unitPrice) : Number(item.unitPrice);
      const itemKdvRate = Number(item.kdvRate) || 0;
      const baseItemPrice = newUnitPrice * newQuantity;
      const itemKdvAmount = (baseItemPrice * itemKdvRate) / 100;
      const newTotalPrice = baseItemPrice + itemKdvAmount;

      await tx.workOrderItem.update({
        where: { id: itemId },
        data: {
          name: newName,
          unitPrice: newUnitPrice,
          quantity: newQuantity,
          totalPrice: newTotalPrice,
        },
      });

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
          notes: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  }

  async updateItemQuantity(
    tenantId: string,
    workOrderId: string,
    itemId: string,
    quantity: number,
    author: string,
  ): Promise<any> {
    return this.updateItem(tenantId, workOrderId, itemId, { quantity }, author);
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

  async addNote(
    tenantId: string,
    workOrderId: string,
    authorId: string | null,
    authorName: string,
    text: string,
    isInternal = true,
  ): Promise<any> {
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    return this.prisma.workOrderNote.create({
      data: {
        workOrderId,
        authorId,
        authorName,
        text,
        isInternal,
      },
    });
  }

  async findNoteById(tenantId: string, noteId: string): Promise<any | null> {
    return this.prisma.workOrderNote.findFirst({
      where: {
        id: noteId,
        workOrder: { tenantId },
      },
      include: {
        workOrder: true,
      },
    });
  }

  async updateNote(tenantId: string, workOrderId: string, noteId: string, text: string): Promise<any> {
    const note = await this.findNoteById(tenantId, noteId);
    if (!note || note.workOrderId !== workOrderId) {
      throw new NotFoundException('Not bulunamadı.');
    }

    return this.prisma.workOrderNote.update({
      where: { id: noteId },
      data: { text },
    });
  }

  async deleteNote(tenantId: string, workOrderId: string, noteId: string): Promise<any> {
    const note = await this.findNoteById(tenantId, noteId);
    if (!note || note.workOrderId !== workOrderId) {
      throw new NotFoundException('Not bulunamadı.');
    }

    return this.prisma.workOrderNote.delete({
      where: { id: noteId },
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
