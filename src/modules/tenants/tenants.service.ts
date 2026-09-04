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
}
