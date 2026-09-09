import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { FuelType, TransmissionType } from '@prisma/client';

export interface CreateVehicleDto {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  vin?: string;
  engineNo?: string;
  color?: string;
  fuelType?: FuelType;
  transmission?: TransmissionType;
  currentKm?: number;
  inspectionValidUntil?: Date;
  insuranceValidUntil?: Date;
  kaskoValidUntil?: Date;
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string) {
    let searchCondition: any = undefined;

    if (search && search.trim()) {
      const q = search.trim();
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

    return this.prisma.vehicle.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...searchCondition,
      },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: true,
        workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        appointments: { orderBy: { slotDate: 'desc' }, take: 10 },
      },
    });

    if (!vehicle) throw new NotFoundException('Araç bulunamadı.');
    return vehicle;
  }

  async create(tenantId: string, dto: CreateVehicleDto) {
    const currentYear = new Date().getFullYear();
    const maxAllowedYear = currentYear + 1; // 2026 için 2027
    if (dto.year && (dto.year < 1950 || dto.year > maxAllowedYear)) {
      throw new BadRequestException(`Araç model yılı 1950 ile ${maxAllowedYear} arasında olmalıdır.`);
    }

    if (dto.currentKm !== undefined && dto.currentKm < 0) {
      throw new BadRequestException('Araç kilometresi negatif olamaz.');
    }

    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId, plate: dto.plate.toUpperCase().trim(), deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Bu plaka ile kayıtlı bir araç zaten mevcut.');
    }

    return this.prisma.vehicle.create({
      data: {
        tenantId,
        customerId: dto.customerId,
        plate: dto.plate.toUpperCase().trim(),
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        vin: dto.vin,
        engineNo: dto.engineNo,
        color: dto.color,
        fuelType: dto.fuelType || FuelType.DIESEL,
        transmission: dto.transmission || TransmissionType.MANUAL,
        currentKm: dto.currentKm || 0,
        inspectionValidUntil: dto.inspectionValidUntil,
        insuranceValidUntil: dto.insuranceValidUntil,
        kaskoValidUntil: dto.kaskoValidUntil,
      },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateVehicleDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        plate: dto.plate ? dto.plate.toUpperCase().trim() : undefined,
      },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
