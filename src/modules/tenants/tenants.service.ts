import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: { select: { id: true, name: true, surname: true, role: true, phone: true } },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Servis işletmesi bulunamadı.');
    }

    return tenant;
  }

  async updateCurrent(tenantId: string, dto: UpdateTenantDto) {
    await this.getCurrent(tenantId);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }

  async getBySlugPublic(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        district: true,
        logoUrl: true,
        isActive: true,
        services: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            defaultDurationMin: true,
            basePrice: true,
            category: true,
            code: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(`"${slug}" adresine sahip aktif bir servis bulunamadı.`);
    }

    return {
      ...tenant,
      services: tenant.services.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        durationMinutes: s.defaultDurationMin,
        laborPrice: Number(s.basePrice),
        category: s.category,
      })),
    };
  }
}
