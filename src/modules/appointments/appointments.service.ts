import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../events/events.gateway';
import { QueueService } from '../queues/queue.service';
import { AppointmentStatus, WorkOrderStatus, NotificationType } from '@prisma/client';

export interface CreatePublicAppointmentDto {
  customerName: string;
  customerPhone: string;
  plate: string;
  brandModel?: string;
  serviceId?: string;
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  customerNotes?: string;
}

export interface CreateAppointmentDto {
  customerId: string;
  vehicleId: string;
  serviceId?: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  customerNotes?: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
    private readonly queueService: QueueService,
  ) {}

  async findAll(tenantId: string, date?: string) {
    return this.prisma.appointment.findMany({
      where: {
        tenantId,
        ...(date ? { slotDate: new Date(date) } : {}),
      },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
      },
      orderBy: { slotStartTime: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new NotFoundException('Geçersiz veya bulunamayan randevu.');
    }

    const app = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
        workOrder: true,
      },
    });
    if (!app) throw new NotFoundException('Randevu bulunamadı.');
    return app;
  }

  async create(tenantId: string, dto: CreateAppointmentDto, userId?: string) {
    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

    let serviceId = dto.serviceId;
    if (!serviceId) {
      const srv = await this.prisma.service.findFirst({ where: { tenantId } });
      if (srv) {
        serviceId = srv.id;
      } else {
        const created = await this.prisma.service.create({
          data: {
            tenant: { connect: { id: tenantId } },
            name: 'Genel Servis & Bakım',
            code: 'SRV-' + Date.now(),
            category: 'GENERAL',
            basePrice: 750,
            defaultDurationMin: 60,
          },
        });
        serviceId = created.id;
      }
    }

    // Concurrency Check 1: Mechanic Double Booking Prevention
    if (dto.assignedMechanicId) {
      const mechanicConflict = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          assignedMechanicId: dto.assignedMechanicId,
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          slotStartTime: { lt: end },
          slotEndTime: { gt: start },
        },
      });

      if (mechanicConflict) {
        throw new ConflictException('Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.');
      }
    }

    // Concurrency Check 2: Lift Double Booking Prevention
    if (dto.assignedLift) {
      const liftConflict = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          assignedLift: dto.assignedLift,
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          slotStartTime: { lt: end },
          slotEndTime: { gt: start },
        },
      });

      if (liftConflict) {
        throw new ConflictException('Seçilen lift bu saat aralığında doludur. Lütfen farklı bir lift veya saat seçiniz.');
      }
    }

    const app = await this.prisma.appointment.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        serviceId,
        assignedMechanicId: dto.assignedMechanicId,
        assignedLift: dto.assignedLift,
        slotDate: new Date(dto.slotDate),
        slotStartTime: start,
        slotEndTime: end,
        customerNotes: dto.customerNotes,
        status: AppointmentStatus.CONFIRMED,
      } as any,
      include: { customer: true, vehicle: true, service: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.created',
      entityName: 'Appointment',
      entityId: app.id,
      changesAfter: {
        customerName: `${app.customer?.firstName || ''} ${app.customer?.lastName || ''}`.trim() || 'Müşteri Belirtilmedi',
        plate: app.vehicle?.plate || 'Plaka Belirtilmedi',
        serviceName: app.service?.name || 'Genel Servis',
        slotDate: app.slotDate,
        status: app.status,
      },
    });

    const custName = `${app.customer?.firstName || ''} ${app.customer?.lastName || ''}`.trim() || 'Müşteri';
    const plate = app.vehicle?.plate || 'Plaka Belirtilmedi';
    const dateStr = app.slotDate ? new Date(app.slotDate).toLocaleDateString('tr-TR') : '';

    // Canlı WebSocket & In-App Bildirim
    await this.notificationsService.createNotification({
      tenantId,
      actorUserId: userId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'CASHIER'],
      category: 'APPOINTMENT',
      type: 'INFO' as any,
      title: `Yeni Randevu: ${plate}`,
      message: `${custName} - ${app.service?.name || 'Genel Servis'} (${dateStr}) randevusu oluşturuldu.`,
      link: '/appointments',
      recipientPhone: app.customer?.phone || undefined,
      sendSms: true,
      metadata: { appointmentId: app.id, plate, customerName: custName },
    });

    this.eventsGateway.emitToTenant(tenantId, 'appointment:created', {
      appointmentId: app.id,
      plate,
      customerName: custName,
      slotDate: app.slotDate,
      slotStartTime: app.slotStartTime,
    });

    // Randevudan 24 saat öncesi için BullMQ zamanlanmış hatırlatıcı planla
    try {
      const reminderTime = new Date(app.slotStartTime).getTime() - 24 * 60 * 60 * 1000;
      const delayMs = Math.max(1000, reminderTime - Date.now());
      await this.queueService.scheduleAppointmentReminder(app.id, delayMs, {
        tenantId,
        customerName: custName,
        customerPhone: app.customer?.phone,
        plate,
        slotDate: dateStr,
      });
    } catch (e: any) {
      // Background schedule fallback
    }

    return app;
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: AppointmentStatus,
    cancellationReason?: string,
    userId?: string,
  ) {
    const current = await this.findOne(tenantId, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status, cancellationReason },
      include: { customer: true, vehicle: true, service: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: status === AppointmentStatus.CANCELLED ? 'appointment.cancelled' : 'appointment.status_changed',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { 
        status: current.status,
        customerName: `${current.customer?.firstName || ''} ${current.customer?.lastName || ''}`.trim(),
        plate: current.vehicle?.plate,
      },
      changesAfter: { 
        status: updated.status, 
        cancellationReason: cancellationReason || undefined,
        customerName: `${updated.customer?.firstName || ''} ${updated.customer?.lastName || ''}`.trim(),
        plate: updated.vehicle?.plate,
      },
    });

    const plate = updated.vehicle?.plate || 'Araç';
    if (status === AppointmentStatus.CANCELLED) {
      await this.notificationsService.createNotification({
        tenantId,
        actorUserId: userId,
        targetRoles: ['OWNER', 'SERVICE_MANAGER', 'CASHIER'],
        category: 'APPOINTMENT',
        type: 'WARNING' as any,
        title: `Randevu İptal Edildi: ${plate}`,
        message: cancellationReason ? `İptal Gerekçesi: ${cancellationReason}` : `${plate} plakalı randevu iptal edildi.`,
        link: '/appointments',
        metadata: { appointmentId: id, plate, cancellationReason },
      });

      this.eventsGateway.emitToTenant(tenantId, 'appointment:cancelled', {
        appointmentId: id,
        plate,
        cancellationReason,
      });
    } else {
      this.eventsGateway.emitToTenant(tenantId, 'appointment:status_changed', {
        appointmentId: id,
        status,
        plate,
      });
    }

    return updated;
  }

  async approve(tenantId: string, id: string, userId?: string) {
    return this.updateStatus(tenantId, id, AppointmentStatus.CONFIRMED, undefined, userId);
  }

  async reschedule(
    tenantId: string,
    id: string,
    dto: { slotDate: string; slotStartTime: string; slotEndTime: string; assignedMechanicId?: string; assignedLift?: string },
    userId?: string,
  ) {
    const current = await this.findOne(tenantId, id);
    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

    const targetMechanicId = dto.assignedMechanicId !== undefined ? dto.assignedMechanicId : current.assignedMechanicId;
    const targetLift = dto.assignedLift !== undefined ? dto.assignedLift : current.assignedLift;

    if (targetMechanicId) {
      const mechConflict = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          id: { not: id },
          assignedMechanicId: targetMechanicId,
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_SERVICE] },
          slotStartTime: { lt: end },
          slotEndTime: { gt: start },
        },
      });
      if (mechConflict) {
        throw new BadRequestException('Seçilen teknisyen belirtilen yeni saat aralığında başka bir randevudadır.');
      }
    }

    if (targetLift) {
      const liftConflict = await this.prisma.appointment.findFirst({
        where: {
          tenantId,
          id: { not: id },
          assignedLift: targetLift,
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_SERVICE] },
          slotStartTime: { lt: end },
          slotEndTime: { gt: start },
        },
      });
      if (liftConflict) {
        throw new BadRequestException(`Lift ${targetLift} belirtilen yeni saat aralığında doludur.`);
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        slotDate: new Date(dto.slotDate),
        slotStartTime: start,
        slotEndTime: end,
        assignedMechanicId: targetMechanicId || null,
        assignedLift: targetLift || null,
        status: AppointmentStatus.CONFIRMED,
      },
      include: { customer: true, vehicle: true, service: true },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.rescheduled',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: {
        slotDate: current.slotDate,
        slotStartTime: current.slotStartTime,
        slotEndTime: current.slotEndTime,
        assignedMechanicId: current.assignedMechanicId,
        assignedLift: current.assignedLift,
      },
      changesAfter: {
        slotDate: updated.slotDate,
        slotStartTime: updated.slotStartTime,
        slotEndTime: updated.slotEndTime,
        assignedMechanicId: updated.assignedMechanicId,
        assignedLift: updated.assignedLift,
      },
    });

    const plate = updated.vehicle?.plate || 'Araç';
    const dateStr = updated.slotDate ? new Date(updated.slotDate).toLocaleDateString('tr-TR') : '';

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId: userId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      category: 'APPOINTMENT',
      type: 'INFO' as any,
      title: `Randevu Yeniden Planlandı: ${plate}`,
      message: `${plate} randevusu ${dateStr} tarihine yeniden planlandı.`,
      link: '/appointments',
      metadata: { appointmentId: id, plate, slotDate: updated.slotDate },
    });

    this.eventsGateway.emitToTenant(tenantId, 'appointment:rescheduled', {
      appointmentId: id,
      plate,
      slotDate: updated.slotDate,
      slotStartTime: updated.slotStartTime,
    });

    return updated;
  }

  async markNoShow(tenantId: string, id: string, userId?: string) {
    const current = await this.findOne(tenantId, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.NO_SHOW },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.no_show',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: current.status },
      changesAfter: { status: AppointmentStatus.NO_SHOW },
    });

    return {
      success: true,
      message: 'Randevu "Gelmedi (No-Show)" olarak işaretlendi.',
      appointment: updated,
    };
  }

  async cancelAppointment(
    tenantId: string,
    id: string,
    reason: string,
    userId?: string,
  ) {
    const current = await this.findOne(tenantId, id);

    // If there is an associated active work order, cancel it too and restore reserved parts
    if (
      current.workOrder &&
      current.workOrder.status !== WorkOrderStatus.CANCELLED &&
      current.workOrder.status !== WorkOrderStatus.COMPLETED
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.workOrder.update({
          where: { id: current.workOrder!.id },
          data: { status: WorkOrderStatus.CANCELLED },
        });

        const items = await tx.workOrderItem.findMany({
          where: { workOrderId: current.workOrder!.id },
        });

        for (const item of items) {
          if (item.itemType === 'PART' && item.itemId) {
            await tx.product.update({
              where: { id: item.itemId },
              data: { stockQuantity: { increment: item.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.itemId,
                movementType: 'RETURN',
                quantity: item.quantity,
                referenceId: current.workOrder!.id,
                note: `Randevu iptali nedeniyle iş emrinden stok iadesi`,
                createdBy: userId || 'SYSTEM',
              },
            });
          }
        }
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'work_order.auto_cancelled',
        entityName: 'WorkOrder',
        entityId: current.workOrder.id,
        changesAfter: { reason: 'Appointment cancelled: ' + reason },
      });
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.cancelled',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { status: current.status },
      changesAfter: { status: AppointmentStatus.CANCELLED, cancellationReason: reason },
    });

    return {
      success: true,
      message: 'Randevu başarıyla iptal edildi.',
      appointment: updated,
    };
  }

  async createPublicAppointment(slug: string, dto: CreatePublicAppointmentDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Belirtilen oto servisi bulunamadı veya hizmete kapalıdır.');
    }

    const cleanPhone = dto.customerPhone.replace(/\D/g, '');
    const cleanPlate = dto.plate.toUpperCase().trim();

    // 1. Müşteri bul veya oluştur
    let customer = await this.prisma.customer.findFirst({
      where: {
        tenantId: tenant.id,
        phone: { contains: cleanPhone.slice(-10) },
      },
    });

    if (!customer) {
      const parts = dto.customerName.trim().split(' ');
      const firstName = parts[0] || 'Müşteri';
      const lastName = parts.slice(1).join(' ') || '-';
      customer = await this.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          phone: dto.customerPhone,
        },
      });
    }

    // 2. Araç bul veya oluştur
    let vehicle = await this.prisma.vehicle.findFirst({
      where: {
        tenantId: tenant.id,
        plate: cleanPlate,
      },
    });

    if (!vehicle) {
      const brandParts = (dto.brandModel || 'Genel Araç').trim().split(' ');
      vehicle = await this.prisma.vehicle.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          plate: cleanPlate,
          brand: brandParts[0] || 'Genel',
          model: brandParts.slice(1).join(' ') || 'Model',
          year: new Date().getFullYear(),
        },
      });
    }

    // 3. Hizmet belirle veya oluştur
    let targetServiceId = dto.serviceId;
    if (!targetServiceId) {
      let defaultService = await this.prisma.service.findFirst({
        where: { tenantId: tenant.id, isActive: true },
      });
      if (!defaultService) {
        defaultService = await this.prisma.service.create({
          data: {
            tenant: { connect: { id: tenant.id } },
            name: 'Genel Bakım & Kontrol',
            code: 'SRV-GENEL',
            category: 'Periyodik Bakım',
            defaultDurationMin: 60,
            basePrice: 500,
          },
        });
      }
      targetServiceId = defaultService.id;
    }

    // 4. Randevu oluştur
    const appointment = await this.prisma.appointment.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        customer: { connect: { id: customer.id } },
        vehicle: { connect: { id: vehicle.id } },
        service: { connect: { id: targetServiceId } },
        slotDate: new Date(dto.slotDate),
        slotStartTime: new Date(dto.slotStartTime),
        slotEndTime: new Date(dto.slotEndTime),
        customerNotes: dto.customerNotes || 'Web üzerinden online randevu oluşturuldu.',
        status: AppointmentStatus.PENDING,
      },
      include: {
        customer: true,
        vehicle: true,
        service: true,
      },
    });

    // 4. WebSocket & Bildirim
    this.eventsGateway.emitToTenant(tenant.id, 'appointment:created', {
      appointmentId: appointment.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      plate: vehicle.plate,
      slotDate: dto.slotDate,
      isOnlineBooking: true,
    });

    await this.notificationsService.createNotification({
      tenantId: tenant.id,
      title: 'Yeni Online Randevu!',
      message: `${vehicle.plate} plakalı araç için ${dto.slotDate} tarihine randevu talebi alındı.`,
      type: NotificationType.INFO,
      category: 'APPOINTMENT',
      link: '/appointments',
    });

    return {
      success: true,
      message: 'Randevu talebiniz başarıyla alındı. Servis danışmanımız sizinle iletişime geçecektir.',
      appointment,
    };
  }
}
