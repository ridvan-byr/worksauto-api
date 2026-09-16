import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  IVehicleRepository,
  FindVehiclesOptions,
} from '../domain/vehicle.repository.interface';
import {
  VehicleEntity,
  VehicleFuelType,
  VehicleTransmissionType,
} from '../domain/vehicle.entity';
import { FuelType, TransmissionType } from '@prisma/client';

@Injectable()
export class PrismaVehicleRepository implements IVehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): VehicleEntity {
    let lastServiceDate: string | null = null;
    let lastServiceStatus: string | null = null;

    if (data.workOrders && data.workOrders.length > 0) {
      const completedWo = data.workOrders.find(
        (w: any) => w.status === 'COMPLETED',
      );
      const targetWo = completedWo || data.workOrders[0];
      const d = targetWo.completedAt || targetWo.createdAt;
      lastServiceDate = d ? new Date(d).toISOString() : null;
      lastServiceStatus = data.workOrders[0]?.status || null;
    }

    return new VehicleEntity({
      id: data.id,
      tenantId: data.tenantId,
      customerId: data.customerId,
      plate: data.plate,
      brand: data.brand,
      model: data.model,
      year: data.year,
      vin: data.vin ?? undefined,
      engineNo: data.engineNo ?? undefined,
      color: data.color ?? undefined,
      fuelType: data.fuelType as VehicleFuelType,
      transmission: data.transmission as VehicleTransmissionType,
      currentKm: data.currentKm ?? 0,
      inspectionValidUntil: data.inspectionValidUntil ?? undefined,
      insuranceValidUntil: data.insuranceValidUntil ?? undefined,
      kaskoValidUntil: data.kaskoValidUntil ?? undefined,
      deletedAt: data.deletedAt ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      customer: data.customer,
      appointments: data.appointments,
      workOrders: data.workOrders,
      lastServiceDate,
      lastServiceStatus,
    });
  }

  async findById(tenantId: string, id: string): Promise<VehicleEntity | null> {
    const record = await this.prisma.vehicle.findFirst({
      where: { id, tenantId, deletedAt: null, customer: { deletedAt: null } },
      include: {
        customer: true,
        workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        appointments: { orderBy: { slotDate: 'desc' }, take: 10 },
      },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async findByPlate(
    tenantId: string,
    plate: string,
  ): Promise<VehicleEntity | null> {
    const cleanPlate = VehicleEntity.normalizePlate(plate);
    const record = await this.prisma.vehicle.findFirst({
      where: {
        tenantId,
        plate: cleanPlate,
        deletedAt: null,
        customer: { deletedAt: null },
      },
      include: { customer: true },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async findByPlateAny(
    tenantId: string,
    plate: string,
  ): Promise<VehicleEntity | null> {
    const cleanPlate = VehicleEntity.normalizePlate(plate);
    const record = await this.prisma.vehicle.findFirst({
      where: {
        tenantId,
        plate: cleanPlate,
      },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async findAll(
    tenantId: string,
    options?: FindVehiclesOptions,
  ): Promise<VehicleEntity[]> {
    let searchCondition: any = undefined;

    if (options?.search && options.search.trim()) {
      const q = options.search.trim();
      const cleanQ = q.replace(/\s+/g, '');
      const parts = q.split(/\s+/).filter(Boolean);

      const orList: any[] = [
        { plate: { contains: q, mode: 'insensitive' } },
        { plate: { contains: cleanQ, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { vin: { contains: q, mode: 'insensitive' } },
        { engineNo: { contains: q, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { companyTitle: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { phone: { contains: cleanQ } },
            ],
          },
        },
      ];

      if (parts.length >= 2) {
        const firstPart = parts[0];
        const restPart = parts.slice(1).join(' ');
        orList.push({
          customer: {
            AND: [
              { firstName: { contains: firstPart, mode: 'insensitive' } },
              { lastName: { contains: restPart, mode: 'insensitive' } },
            ],
          },
        });
      }

      searchCondition = { OR: orList };
    }

    const where: any = {
      tenantId,
      deletedAt: null,
      customer: { deletedAt: null },
      ...searchCondition,
    };

    if (options?.customerId) {
      where.customerId = options.customerId;
    }

    const records = await this.prisma.vehicle.findMany({
      where,
      include: {
        customer: true,
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            createdAt: true,
            completedAt: true,
            initialKm: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapToEntity(r));
  }

  async save(vehicle: VehicleEntity): Promise<VehicleEntity> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: vehicle.customerId,
        tenantId: vehicle.tenantId,
        deletedAt: null,
      },
    });
    if (!customer) {
      throw new BadRequestException(
        'Müşteri bulunamadı veya bu işletmeye ait değil.',
      );
    }

    const created = await this.prisma.vehicle.create({
      data: {
        tenantId: vehicle.tenantId,
        customerId: vehicle.customerId,
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        engineNo: vehicle.engineNo,
        color: vehicle.color,
        fuelType: (vehicle.fuelType || 'DIESEL') as FuelType,
        transmission: (vehicle.transmission || 'MANUAL') as TransmissionType,
        currentKm: vehicle.currentKm || 0,
        inspectionValidUntil: vehicle.inspectionValidUntil,
        insuranceValidUntil: vehicle.insuranceValidUntil,
        kaskoValidUntil: vehicle.kaskoValidUntil,
      },
      include: { customer: true },
    });

    return this.mapToEntity(created);
  }

  async update(vehicle: VehicleEntity): Promise<VehicleEntity> {
    if (!vehicle.id) {
      throw new Error('Araç güncellemesi için id gereklidir.');
    }

    const existing = await this.prisma.vehicle.findFirst({
      where: { id: vehicle.id, tenantId: vehicle.tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new BadRequestException(
        'Araç bulunamadı veya bu işletmeye ait değil.',
      );
    }

    if (vehicle.customerId && vehicle.customerId !== existing.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: vehicle.customerId,
          tenantId: vehicle.tenantId,
          deletedAt: null,
        },
      });
      if (!customer) {
        throw new BadRequestException(
          'Müşteri bulunamadı veya bu işletmeye ait değil.',
        );
      }
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        engineNo: vehicle.engineNo,
        color: vehicle.color,
        fuelType: vehicle.fuelType as FuelType,
        transmission: vehicle.transmission as TransmissionType,
        currentKm: vehicle.currentKm,
        inspectionValidUntil: vehicle.inspectionValidUntil,
        insuranceValidUntil: vehicle.insuranceValidUntil,
        kaskoValidUntil: vehicle.kaskoValidUntil,
      },
      include: { customer: true },
    });

    return this.mapToEntity(updated);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    await this.prisma.vehicle.updateMany({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  async transferOwnership(
    tenantId: string,
    vehicleId: string,
    newCustomerId: string,
  ): Promise<VehicleEntity> {
    const targetCustomer = await this.prisma.customer.findFirst({
      where: { id: newCustomerId, tenantId, deletedAt: null },
    });
    if (!targetCustomer) {
      throw new BadRequestException(
        'Devralacak müşteri bulunamadı veya silinmiş.',
      );
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundException('Devredilecek araç bulunamadı.');
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        customerId: newCustomerId,
        deletedAt: null, // Eğer arşivdeyse aktifleştir
      },
      include: { customer: true },
    });

    return this.mapToEntity(updated);
  }
}
