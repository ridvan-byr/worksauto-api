import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

export interface CreateAppointmentDto {
  customerId: string;
  vehicleId: string;
  serviceId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  customerNotes?: string;
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(tenantId: string, dto: CreateAppointmentDto) {
    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);

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

    return this.prisma.appointment.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        vehicleId: dto.vehicleId,
        serviceId: dto.serviceId,
        assignedMechanicId: dto.assignedMechanicId,
        assignedLift: dto.assignedLift,
        slotDate: new Date(dto.slotDate),
        slotStartTime: start,
        slotEndTime: end,
        customerNotes: dto.customerNotes,
        status: AppointmentStatus.CONFIRMED,
      },
      include: { customer: true, vehicle: true, service: true },
    });
  }

  async updateStatus(tenantId: string, id: string, status: AppointmentStatus, cancellationReason?: string) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status, cancellationReason },
    });
  }
}
