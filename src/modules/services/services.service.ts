import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    tenantId: string,
    filters?: { search?: string; category?: string; isActive?: boolean },
  ) {
    const where: Prisma.ServiceWhereInput = { tenantId };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.service.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId },
    });
    if (!service) throw new NotFoundException('Hizmet / işçilik kalemi bulunamadı.');
    return service;
  }

  async create(tenantId: string, dto: CreateServiceDto, userId?: string) {
    // Check unique code within tenant
    const existing = await this.prisma.service.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`"${dto.code}" koduna sahip bir hizmet zaten mevcut.`);
    }

    const service = await this.prisma.service.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        category: dto.category.toUpperCase(),
        defaultDurationMin: dto.defaultDurationMin ?? 60,
        basePrice: dto.basePrice,
        kdvRate: dto.kdvRate ?? 20,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'service.created',
      entityName: 'Service',
      entityId: service.id,
      changesAfter: { name: service.name, code: service.code, price: service.basePrice },
    });

    return service;
  }

  async update(tenantId: string, id: string, dto: UpdateServiceDto, userId?: string) {
    const current = await this.findOne(tenantId, id);

    if (dto.code && dto.code !== current.code) {
      const existing = await this.prisma.service.findFirst({
        where: { tenantId, code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`"${dto.code}" koduna sahip başka bir hizmet zaten mevcut.`);
      }
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.code && { code: dto.code.toUpperCase() }),
        ...(dto.category && { category: dto.category.toUpperCase() }),
        ...(dto.defaultDurationMin !== undefined && { defaultDurationMin: dto.defaultDurationMin }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.kdvRate !== undefined && { kdvRate: dto.kdvRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'service.updated',
      entityName: 'Service',
      entityId: id,
      changesBefore: { name: current.name, basePrice: current.basePrice, isActive: current.isActive },
      changesAfter: { name: updated.name, basePrice: updated.basePrice, isActive: updated.isActive },
    });

    return updated;
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const service = await this.findOne(tenantId, id);

    const appointmentsCount = await this.prisma.appointment.count({
      where: { serviceId: id },
    });

    const isDeactivated = appointmentsCount > 0;
    if (isDeactivated) {
      await this.prisma.service.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      await this.prisma.service.delete({
        where: { id },
      });
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: isDeactivated ? 'service.deactivated' : 'service.deleted',
      entityName: 'Service',
      entityId: id,
      changesBefore: {
        id: service.id,
        name: service.name,
        code: service.code,
        category: service.category,
        basePrice: Number(service.basePrice),
        defaultDurationMin: service.defaultDurationMin,
        isActive: service.isActive,
      },
      changesAfter: {
        status: isDeactivated ? 'PASİFE ALINDI (INACTIVE)' : 'KALICI SİLİNDİ (DELETED)',
        reason: isDeactivated
          ? `Bu hizmete bağlı ${appointmentsCount} adet randevu geçmişi korunduğu için pasife alındı.`
          : 'Hizmet kataloğundan kalıcı olarak kaldırıldı.',
      },
    });

    return { 
      success: true, 
      message: isDeactivated 
        ? 'Hizmete bağlı randevular bulunduğu için geçmişi korumak adına pasife alındı.' 
        : 'Hizmet başarıyla kaldırıldı.' 
    };
  }
}
