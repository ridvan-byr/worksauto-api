import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import {
  CreateWorkshopBayDto,
  UpdateWorkshopBayDto,
} from './dto/workshop-bays.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            surname: true,
            role: true,
            phone: true,
          },
        },
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

  async getBays(tenantId: string) {
    let bays = await this.prisma.workshopBay.findMany({
      where: { tenantId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    if (bays.length === 0) {
      // Auto-initialize standard default bays for zero-downtime transition
      const defaults = [
        {
          name: 'Lift 1 (Genel Mekanik)',
          code: 'L-01',
          category: 'TWO_POST_LIFT',
          orderIndex: 1,
          isAvailableForOnline: true,
        },
        {
          name: 'Lift 2 (Hızlı Bakım & Yağ)',
          code: 'L-02',
          category: 'TWO_POST_LIFT',
          orderIndex: 2,
          isAvailableForOnline: true,
        },
        {
          name: 'Lift 3 (Ağır Bakım & Şanzıman)',
          code: 'L-03',
          category: 'FOUR_POST_LIFT',
          orderIndex: 3,
          isAvailableForOnline: false,
        },
        {
          name: 'Lift 4 (Rot & Balans)',
          code: 'L-04',
          category: 'ALIGNMENT',
          orderIndex: 4,
          isAvailableForOnline: false,
        },
        {
          name: 'Kabul / Ekspertiz Alanı',
          code: 'KB-01',
          category: 'DIAGNOSTIC',
          orderIndex: 5,
          isAvailableForOnline: true,
        },
      ];

      await this.prisma.workshopBay.createMany({
        data: defaults.map((d) => ({
          tenantId,
          ...d,
        })),
        skipDuplicates: true,
      });

      bays = await this.prisma.workshopBay.findMany({
        where: { tenantId },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    }

    return bays;
  }

  async createBay(tenantId: string, dto: CreateWorkshopBayDto) {
    const existing = await this.prisma.workshopBay.findFirst({
      where: { tenantId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `"${dto.name}" adında bir istasyon / lift zaten mevcut.`,
      );
    }

    return this.prisma.workshopBay.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        category: dto.category || 'GENERAL',
        isAvailableForOnline: dto.isAvailableForOnline ?? true,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  async updateBay(tenantId: string, id: string, dto: UpdateWorkshopBayDto) {
    const bay = await this.prisma.workshopBay.findFirst({
      where: { id, tenantId },
    });
    if (!bay) {
      throw new NotFoundException('İstasyon / Lift kaydı bulunamadı.');
    }

    if (dto.name && dto.name.trim() !== bay.name) {
      const duplicate = await this.prisma.workshopBay.findFirst({
        where: { tenantId, name: dto.name.trim(), NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(
          `"${dto.name}" adında başka bir istasyon / lift zaten mevcut.`,
        );
      }
    }

    return this.prisma.workshopBay.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isAvailableForOnline !== undefined
          ? { isAvailableForOnline: dto.isAvailableForOnline }
          : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
      },
    });
  }

  async deleteBay(tenantId: string, id: string) {
    const bay = await this.prisma.workshopBay.findFirst({
      where: { id, tenantId },
    });
    if (!bay) {
      throw new NotFoundException('İstasyon / Lift kaydı bulunamadı.');
    }

    return this.prisma.workshopBay.delete({
      where: { id },
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
        workshopBays: {
          where: { isActive: true, isAvailableForOnline: true },
          select: {
            id: true,
            name: true,
            category: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(
        `"${slug}" adresine sahip aktif bir servis bulunamadı.`,
      );
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
      workshopBays: tenant.workshopBays,
    };
  }

  async completeOnboarding(tenantId: string, dto: CompleteOnboardingDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Update Tenant profile & settings
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          title: dto.name ? dto.name.trim() : undefined,
          legalName: dto.legalName ? dto.legalName.trim() : undefined,
          taxOffice: dto.taxOffice ? dto.taxOffice.trim() : undefined,
          taxNumber: dto.taxNumber ? dto.taxNumber.trim() : undefined,
          city: dto.city ? dto.city.trim() : undefined,
          district: dto.district ? dto.district.trim() : undefined,
          address: dto.address ? dto.address.trim() : undefined,
          workingDays: dto.workingDays || undefined,
          workStartTime: dto.workStartTime || undefined,
          workEndTime: dto.workEndTime || undefined,
          breakStartTime: dto.breakStartTime || undefined,
          breakEndTime: dto.breakEndTime || undefined,
          appointmentSlotDuration: dto.appointmentSlotDuration || undefined,
          activeLiftCount: dto.activeLiftCount || undefined,
          criticalStockThreshold: dto.criticalStockThreshold || undefined,
          onboardingCompleted: true,
        },
      });

      // 2. Initial Services
      if (dto.services && dto.services.length > 0) {
        let srvIndex = 1;
        for (const s of dto.services) {
          if (!s.name || !s.name.trim()) continue;
          const trimmedName = s.name.trim();
          const existing = await tx.service.findFirst({
            where: { tenantId, name: trimmedName },
          });
          if (!existing) {
            const code = `SRV-${String(srvIndex).padStart(2, '0')}`;
            await tx.service.create({
              data: {
                tenantId,
                name: trimmedName,
                code,
                category: s.category?.trim() || 'Periyodik Bakım',
                defaultDurationMin: s.durationMinutes || 60,
                basePrice: s.laborPrice || 0,
                isActive: true,
              },
            });
            srvIndex++;
          }
        }
      }

      // 3. Initial Staff / Mechanics
      if (dto.staff && dto.staff.length > 0) {
        const branch = await tx.branch.findFirst({ where: { tenantId } });
        for (const st of dto.staff) {
          if (!st.name || !st.name.trim() || !st.phone) continue;
          const rawDigits = st.phone.replace(/\D/g, '');
          const normalizedPhone = rawDigits.startsWith('90')
            ? '+' + rawDigits
            : rawDigits.startsWith('0')
              ? '+9' + rawDigits
              : '+90' + rawDigits;

          const existingUser = await tx.user.findFirst({
            where: {
              OR: [
                { phone: normalizedPhone },
                { phone: rawDigits },
                { phone: '+' + rawDigits },
              ],
            },
          });

          if (!existingUser) {
            const user = await tx.user.create({
              data: {
                tenantId,
                branchId: branch?.id,
                name: st.name.trim(),
                surname: st.surname?.trim() || '',
                phone: normalizedPhone,
                role: UserRole.TECHNICIAN,
                isActive: true,
              },
            });

            await tx.mechanic.create({
              data: {
                tenantId,
                userId: user.id,
                specialty: st.expertise?.trim() || 'Genel Mekanik',
                dailyCapacityHours: 8,
              },
            });
          }
        }
      }

      // 4. Initial Bays based on activeLiftCount
      if (dto.activeLiftCount && dto.activeLiftCount > 0) {
        const existingBayCount = await tx.workshopBay.count({
          where: { tenantId },
        });
        if (existingBayCount === 0) {
          const bayData: Array<{
            tenantId: string;
            name: string;
            code: string;
            category: string;
            orderIndex: number;
            isAvailableForOnline: boolean;
          }> = [];
          for (let i = 1; i <= dto.activeLiftCount; i++) {
            bayData.push({
              tenantId,
              name: `Lift ${i} (Genel Mekanik)`,
              code: `L-0${i}`,
              category: 'TWO_POST_LIFT',
              orderIndex: i,
              isAvailableForOnline: true,
            });
          }
          await tx.workshopBay.createMany({ data: bayData });
        }
      }

      return {
        success: true,
        message: 'Atölye kurulumu ve başlangıç kayıtları başarıyla tamamlandı.',
        tenant: updatedTenant,
      };
    });
  }
}
