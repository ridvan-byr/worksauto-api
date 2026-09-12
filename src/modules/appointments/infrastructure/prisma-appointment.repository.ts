import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { IAppointmentRepository } from '../domain/appointment.repository.interface';
import {
  AppointmentEntity,
  AppointmentStatusType,
} from '../domain/appointment.entity';
import {
  AppointmentStatus,
  WorkOrderStatus,
  CustomerType,
} from '@prisma/client';

@Injectable()
export class PrismaAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): AppointmentEntity {
    // Map Prisma IN_SERVICE status to Domain IN_PROGRESS if needed
    const status: AppointmentStatusType =
      data.status === AppointmentStatus.IN_SERVICE
        ? 'IN_PROGRESS'
        : (data.status as AppointmentStatusType);

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
      status,
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

  private mapStatusToPrisma(status?: string): AppointmentStatus {
    if (!status) return AppointmentStatus.PENDING;
    if (status === 'IN_PROGRESS') return AppointmentStatus.IN_SERVICE;
    return status as AppointmentStatus;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<AppointmentEntity | null> {
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
    let dateFilter: Date | undefined;
    if (date) {
      // Clean ISO or YYYY-MM-DD date matching
      const cleanDateStr = date.split('T')[0];
      dateFilter = new Date(`${cleanDateStr}T00:00:00.000Z`);
    }

    const data = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { slotDate: dateFilter } : {}),
      },
      include: {
        customer: true,
        vehicle: true,
        service: true,
        assignedMechanic: { include: { user: true } },
        workOrder: true,
      },
      orderBy: { slotStartTime: 'asc' },
    });
    return data.map((d) => this.mapToEntity(d));
  }

  async create(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findFirst({
        where: {
          id: appointment.customerId,
          tenantId: appointment.tenantId,
          deletedAt: null,
        },
      }),
      this.prisma.vehicle.findFirst({
        where: {
          id: appointment.vehicleId,
          tenantId: appointment.tenantId,
          deletedAt: null,
        },
      }),
    ]);

    if (!customer) {
      throw new BadRequestException(
        'Müşteri bulunamadı veya bu işletmeye ait değil.',
      );
    }
    if (!vehicle) {
      throw new BadRequestException(
        'Araç bulunamadı veya bu işletmeye ait değil.',
      );
    }
    if (vehicle.customerId !== appointment.customerId) {
      throw new BadRequestException(
        'Seçilen araç belirtilen müşteriye ait değil.',
      );
    }

    if (appointment.assignedMechanicId) {
      const mechanic = await this.prisma.mechanic.findFirst({
        where: {
          id: appointment.assignedMechanicId,
          tenantId: appointment.tenantId,
        },
      });
      if (!mechanic) {
        throw new BadRequestException(
          'Atanan teknisyen bu işletmeye ait değil.',
        );
      }
    }

    // Validate and sanitize serviceId (Foreign Key Protection)
    let validatedServiceId: string | null = null;
    if (appointment.serviceId) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          appointment.serviceId,
        );
      if (isUuid) {
        const srv = await this.prisma.service.findFirst({
          where: { id: appointment.serviceId, tenantId: appointment.tenantId },
        });
        if (srv) {
          validatedServiceId = srv.id;
        }
      }
    }

    const slotDate =
      appointment.slotDate instanceof Date
        ? appointment.slotDate
        : new Date(appointment.slotDate);
    const slotStartTime =
      appointment.slotStartTime instanceof Date
        ? appointment.slotStartTime
        : new Date(appointment.slotStartTime);
    const slotEndTime =
      appointment.slotEndTime instanceof Date
        ? appointment.slotEndTime
        : new Date(appointment.slotEndTime);

    return this.prisma.$transaction(async (tx) => {
      // Advisory transaction lock per resource & slot window to serialize concurrent requests
      const lockResource = appointment.assignedLift || appointment.assignedMechanicId || 'slot';
      const lockKey = `${appointment.tenantId}:${lockResource}:${slotStartTime.toISOString()}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Re-verify mechanic conflict inside serialized transaction lock
      if (appointment.assignedMechanicId) {
        const mechanicConflict = await tx.appointment.findFirst({
          where: {
            tenantId: appointment.tenantId,
            assignedMechanicId: appointment.assignedMechanicId,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            slotStartTime: { lt: slotEndTime },
            slotEndTime: { gt: slotStartTime },
          },
        });
        if (mechanicConflict) {
          throw new ConflictException(
            'Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.',
          );
        }
      }

      // Re-verify lift conflict inside serialized transaction lock
      if (appointment.assignedLift) {
        const liftConflict = await tx.appointment.findFirst({
          where: {
            tenantId: appointment.tenantId,
            assignedLift: appointment.assignedLift,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            slotStartTime: { lt: slotEndTime },
            slotEndTime: { gt: slotStartTime },
          },
        });
        if (liftConflict) {
          throw new ConflictException(
            `"${appointment.assignedLift}" için bu saat aralığında başka bir randevu bulunmaktadır.`,
          );
        }
      }

      try {
        const data = await tx.appointment.create({
          data: {
            tenantId: appointment.tenantId,
            customerId: appointment.customerId,
            vehicleId: appointment.vehicleId,
            serviceId: validatedServiceId,
            assignedMechanicId: appointment.assignedMechanicId || null,
            assignedLift: appointment.assignedLift || null,
            slotDate,
            slotStartTime,
            slotEndTime,
            customerNotes: appointment.customerNotes || null,
            status: this.mapStatusToPrisma(appointment.status),
          },
          include: {
            customer: true,
            vehicle: true,
            service: true,
            assignedMechanic: { include: { user: true } },
          },
        });
        return this.mapToEntity(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('no_overlapping_mechanic')) {
          throw new ConflictException(
            'Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.',
          );
        }
        if (msg.includes('no_overlapping_lift')) {
          throw new ConflictException(
            'Seçilen lift için bu saat aralığında başka bir randevu bulunmaktadır.',
          );
        }
        throw err;
      }
    });
  }

  async save(appointment: AppointmentEntity): Promise<AppointmentEntity> {
    const existing = await this.prisma.appointment.findFirst({
      where: { id: appointment.id, tenantId: appointment.tenantId },
    });
    if (!existing) {
      throw new BadRequestException(
        'Randevu bulunamadı veya bu işletmeye ait değil.',
      );
    }

    const slotDate =
      appointment.slotDate instanceof Date
        ? appointment.slotDate
        : new Date(appointment.slotDate);
    const slotStartTime =
      appointment.slotStartTime instanceof Date
        ? appointment.slotStartTime
        : new Date(appointment.slotStartTime);
    const slotEndTime =
      appointment.slotEndTime instanceof Date
        ? appointment.slotEndTime
        : new Date(appointment.slotEndTime);

    // Validate serviceId if updated
    let validatedServiceId = existing.serviceId;
    if (appointment.serviceId !== undefined) {
      if (appointment.serviceId === null) {
        validatedServiceId = null;
      } else {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            appointment.serviceId,
          );
        if (isUuid) {
          const srv = await this.prisma.service.findFirst({
            where: {
              id: appointment.serviceId,
              tenantId: appointment.tenantId,
            },
          });
          validatedServiceId = srv ? srv.id : null;
        } else {
          validatedServiceId = null;
        }
      }
    }

    try {
      const data = await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          slotDate,
          slotStartTime,
          slotEndTime,
          serviceId: validatedServiceId,
          assignedMechanicId: appointment.assignedMechanicId || null,
          assignedLift: appointment.assignedLift || null,
          status: this.mapStatusToPrisma(appointment.status),
          customerNotes: appointment.customerNotes,
          cancellationReason: appointment.cancellationReason,
        },
        include: {
          customer: true,
          vehicle: true,
          service: true,
          assignedMechanic: { include: { user: true } },
          workOrder: true,
        },
      });
      return this.mapToEntity(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('no_overlapping_mechanic')) {
        throw new ConflictException(
          'Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.',
        );
      }
      if (msg.includes('no_overlapping_lift')) {
        throw new ConflictException(
          'Seçilen lift için bu saat aralığında başka bir randevu bulunmaktadır.',
        );
      }
      throw err;
    }
  }

  async checkMechanicConflict(
    tenantId: string,
    mechanicId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<boolean> {
    if (!mechanicId) return false;
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        assignedMechanicId: mechanicId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
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
    if (!lift || !lift.trim()) return false;
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        assignedLift: lift.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
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
      const existing = await tx.appointment.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        throw new BadRequestException(
          'Randevu bulunamadı veya bu işletmeye ait değil.',
        );
      }

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

      if (
        updatedApp.workOrder &&
        updatedApp.workOrder.status !== WorkOrderStatus.CANCELLED
      ) {
        await tx.workOrder.update({
          where: { id: updatedApp.workOrder.id },
          data: {
            status: WorkOrderStatus.CANCELLED,
          },
        });

        const reasonMap: Record<string, string> = {
          CUSTOMER_REQUEST: 'Müşteri randevuyu iptal etti / vazgeçti',
          PARTS_UNAVAILABLE: 'Gerekli yedek parça temin edilemedi',
          CAPACITY_FULL: 'Servis atölye lift kapasitesi dolu',
          PRICE_DISAGREEMENT: 'Fiyat konusunda anlaşılamadı',
          NO_SHOW: 'Randevuya gelinmedi (No-Show)',
          OTHER: 'Diğer gerekçe',
        };
        const localizedReason = reasonMap[reason] || reason;

        await tx.workOrderNote.create({
          data: {
            workOrderId: updatedApp.workOrder.id,
            authorName: 'SİSTEM',
            text: `Bağlı randevu iptal edildi. Gerekçe: ${localizedReason}`,
            isInternal: true,
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

  async findActiveOnlineBays(tenantId: string): Promise<string[]> {
    const bays = await this.prisma.workshopBay.findMany({
      where: {
        tenantId,
        isActive: true,
        isAvailableForOnline: true,
      },
      orderBy: { orderIndex: 'asc' },
      select: { name: true },
    });
    return bays.map((b) => b.name);
  }

  async findOrCreateCustomerForPublic(
    tenantId: string,
    name: string,
    phone: string,
  ): Promise<any> {
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Müşteri';
    const lastName = nameParts.slice(1).join(' ').trim() || '';

    const cleanPhone = phone.trim();

    let customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone: cleanPhone },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId,
          type: CustomerType.INDIVIDUAL,
          firstName,
          lastName,
          phone: cleanPhone,
          isLead: true,
          notes: 'Web Online Randevu Sistemi ile oluşturuldu.',
        },
      });
    } else if (customer.deletedAt !== null) {
      // Restore customer if soft-deleted
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { deletedAt: null },
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

    const brandParts = brandModel ? brandModel.trim().split(/\s+/) : [];
    const brand = brandParts[0] || 'Belirtilmedi';
    const model = brandParts.slice(1).join(' ').trim() || 'Genel Model';

    if (!vehicle) {
      vehicle = await this.prisma.vehicle.create({
        data: {
          tenantId,
          customerId,
          plate: cleanPlate,
          brand,
          model,
          year: new Date().getFullYear(),
        },
      });
    } else {
      const updates: any = {};
      if (vehicle.customerId !== customerId) {
        updates.customerId = customerId;
      }
      if (vehicle.deletedAt !== null) {
        updates.deletedAt = null;
      }
      if (Object.keys(updates).length > 0) {
        vehicle = await this.prisma.vehicle.update({
          where: { id: vehicle.id },
          data: updates,
        });
      }
    }

    return vehicle;
  }
}
