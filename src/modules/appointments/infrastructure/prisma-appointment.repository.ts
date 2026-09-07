import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { IAppointmentRepository } from '../domain/appointment.repository.interface';
import { AppointmentEntity } from '../domain/appointment.entity';
import { AppointmentStatus, WorkOrderStatus, CustomerType } from '@prisma/client';

@Injectable()
export class PrismaAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): AppointmentEntity {
    return new AppointmentEntity({
      id: data.id,
      tenantId: data.tenantId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      serviceId: data.serviceId ?? undefined,
      assignedMechanicId: data.assignedMechanicId ?? undefined,
      assignedLift: data.assignedLift ?? undefined,
      slotDate: data.slotDate,
      slotStartTime: data.slotStartTime,
      slotEndTime: data.slotEndTime,
      status: data.status,
      customerNotes: data.customerNotes ?? undefined,
      cancellationReason: data.cancellationReason ?? undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      customer: data.customer,
      vehicle: data.vehicle,
      service: data.service,
      assignedMechanic: data.assignedMechanic,
      workOrder: data.workOrder,
    });
  }

  async findById(tenantId: string, id: string): Promise<AppointmentEntity | null> {
    const data = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
        workOrder: true,
      },
    });
    return data ? this.mapToEntity(data) : null;
  }

  async findAll(tenantId: string, date?: string): Promise<AppointmentEntity[]> {
    const data = await this.prisma.appointment.findMany({
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
    return data.map((d) => this.mapToEntity(d));
  }

  async create(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    const data = await this.prisma.appointment.create({
      data: {
        tenantId: appointment.tenantId,
        customerId: appointment.customerId,
        vehicleId: appointment.vehicleId,
        serviceId: appointment.serviceId || null,
        assignedMechanicId: appointment.assignedMechanicId || null,
        assignedLift: appointment.assignedLift || null,
        slotDate: appointment.slotDate,
        slotStartTime: appointment.slotStartTime,
        slotEndTime: appointment.slotEndTime,
        customerNotes: appointment.customerNotes,
        status: appointment.status as AppointmentStatus,
      },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
      },
    });
    return this.mapToEntity(data);
  }

  async save(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    const data = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        slotDate: appointment.slotDate,
        slotStartTime: appointment.slotStartTime,
        slotEndTime: appointment.slotEndTime,
        assignedMechanicId: appointment.assignedMechanicId || null,
        assignedLift: appointment.assignedLift || null,
        status: appointment.status as AppointmentStatus,
        customerNotes: appointment.customerNotes,
        cancellationReason: appointment.cancellationReason,
      },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
      },
    });
    return this.mapToEntity(data);
  }

  async checkMechanicConflict(
    tenantId: string,
    mechanicId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        assignedMechanicId: mechanicId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        slotStartTime: { lt: end },
        slotEndTime: { gt: start },
      },
    });
    return !!conflict;
  }

  async checkLiftConflict(
    tenantId: string,
    lift: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        assignedLift: lift,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        slotStartTime: { lt: end },
        slotEndTime: { gt: start },
      },
    });
    return !!conflict;
  }

  async cancelAppointmentAndWorkOrder(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<AppointmentEntity> {
    return this.prisma.$transaction(async (tx) => {
      const updatedApp = await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: reason,
        },
        include: {
          customer: true,
          vehicle: true,
          workOrder: true,
        },
      });

      if (updatedApp.workOrder && updatedApp.workOrder.status !== WorkOrderStatus.CANCELLED) {
        await tx.workOrder.update({
          where: { id: updatedApp.workOrder.id },
          data: {
            status: WorkOrderStatus.CANCELLED,
            cancellationReason: `Bağlı randevu iptal edildi. Neden: ${reason}`,
          },
        });
      }

      return this.mapToEntity(updatedApp);
    });
  }

  async findTenantBySlug(slug: string): Promise<any | null> {
    return this.prisma.tenant.findFirst({
      where: {
        slug,
        isActive: true,
      },
    });
  }

  async findOrCreateCustomerForPublic(tenantId: string, name: string, phone: string): Promise<any> {
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || 'Müşteri';
    const lastName = nameParts.slice(1).join(' ') || '';

    let customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone: phone.trim() },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          type: CustomerType.INDIVIDUAL,
          firstName,
          lastName,
          phone: phone.trim(),
          isLead: true,
          notes: 'Web Online Randevu Sistemi ile oluşturuldu.',
        },
      });
    }

    return customer;
  }

  async findOrCreateVehicleForPublic(
    tenantId: string,
    customerId: string,
    plate: string,
    brandModel?: string,
  ): Promise<any> {
    const cleanPlate = plate.toUpperCase().replace(/\s/g, '');
    let vehicle = await this.prisma.vehicle.findFirst({
      where: { tenantId, plate: cleanPlate },
    });

    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: {
          tenantId,
          customerId,
          plate: cleanPlate,
          brand: brandModel ? brandModel.split(' ')[0] : 'Belirtilmedi',
          model: brandModel ? brandModel.split(' ').slice(1).join(' ') : 'Belirtilmedi',
          year: new Date().getFullYear(),
        },
      });
    }

    return vehicle;
  }
}
