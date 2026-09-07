import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UpdateTenantStatusDto } from '../dto/update-tenant-status.dto';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminTenantService {
  private readonly logger = new Logger(AdminTenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tüm Servis Kiracılarını Listeleme & Filtreleme
   */
  async getTenants(filters?: { status?: string; search?: string; city?: string }) {
    const where: any = {};

    if (filters?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters?.status === 'INACTIVE' || filters?.status === 'SUSPENDED') {
      where.isActive = false;
    }

    if (filters?.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters?.search) {
      const search = filters.search.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { taxNumber: { contains: search } },
        { district: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        {
          users: {
            some: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { surname: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
            workOrders: true,
            vehicles: true,
            customers: true,
          },
        },
        users: {
          where: { role: UserRole.OWNER },
          select: { name: true, surname: true, phone: true, email: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      legalName: t.legalName,
      phone: t.phone,
      email: t.email,
      city: t.city || 'Belirtilmedi',
      district: t.district || '',
      isActive: t.isActive,
      createdAt: t.createdAt,
      owner: t.users[0] ? `${t.users[0].name} ${t.users[0].surname}` : 'Tanımsız',
      ownerPhone: t.users[0]?.phone || t.phone,
      stats: {
        totalStaff: t._count.users,
        totalWorkOrders: t._count.workOrders,
        totalVehicles: t._count.vehicles,
        totalCustomers: t._count.customers,
      },
    }));
  }

  /**
   * Tekil Servis Detayı & Operasyonel Görünüm
   */
  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            surname: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            workOrders: true,
            customers: true,
            vehicles: true,
            products: true,
            invoices: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Servis kaydı bulunamadı.');
    }

    return tenant;
  }

  /**
   * Servis Lisans Durumunu Güncelleme (Aktive Et / Askıya Al)
   */
  async updateTenantStatus(tenantId: string, dto: UpdateTenantStatusDto, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Servis kaydı bulunamadı.');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: dto.isActive },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: adminUserId || null,
          action: dto.isActive ? 'TENANT_ACTIVATED' : 'TENANT_SUSPENDED',
          entityName: 'Tenant',
          entityId: tenantId,
          changesAfter: {
            isActive: dto.isActive,
            reason: dto.reason || 'Super Admin işlem uyguladı.',
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log yazılamadı: ${e}`);
    }

    this.logger.log(
      `🔔 Servis Durumu Güncellendi -> ${tenant.title}: ${dto.isActive ? 'LİSANSLANDI/AKTİF' : 'ASKIYA ALINDI'}`
    );

    return {
      success: true,
      message: dto.isActive ? 'Servis lisansı onaylandı ve aktif edildi.' : 'Servis hesabı donduruldu.',
      tenant: updated,
    };
  }

  /**
   * Yeni Servis (Tenant) & Kurucu (Owner) Kullanıcı Oluşturma
   */
  async createTenant(dto: CreateTenantDto, adminUserId?: string) {
    const rawPhone = dto.phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('90') ? rawPhone.slice(2) : rawPhone;
    const formattedPhone = `+90${cleanPhone}`;

    const existingUser = await this.prisma.user.findFirst({
      where: { phone: formattedPhone },
    });
    if (existingUser) {
      throw new BadRequestException(`Bu telefon numarası (${formattedPhone}) ile kayıtlı bir kullanıcı zaten mevcut.`);
    }

    let baseSlug = dto.title
      .toLowerCase()
      .trim()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!baseSlug) {
      baseSlug = `servis-${Date.now().toString(36)}`;
    }

    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          title: dto.title.trim(),
          legalName: dto.legalName?.trim() || dto.title.trim(),
          phone: formattedPhone,
          email: dto.email.trim().toLowerCase(),
          city: dto.city?.trim() || null,
          district: dto.district?.trim() || null,
          address: dto.address?.trim() || null,
          taxNumber: dto.taxNumber?.trim() || null,
          taxOffice: dto.taxOffice?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });

      const centralBranch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: 'Merkez Şube',
          code: 'MKZ',
          isCentral: true,
          phone: formattedPhone,
          address: dto.address?.trim() || null,
        },
      });

      const ownerUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: centralBranch.id,
          name: dto.ownerName.trim(),
          surname: dto.ownerSurname.trim(),
          phone: formattedPhone,
          email: dto.email.trim().toLowerCase(),
          role: UserRole.OWNER,
          isActive: true,
        },
      });

      try {
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            userId: adminUserId || null,
            action: 'TENANT_CREATED',
            entityName: 'Tenant',
            entityId: tenant.id,
            changesAfter: {
              title: tenant.title,
              slug: tenant.slug,
              owner: `${ownerUser.name} ${ownerUser.surname}`,
              phone: formattedPhone,
              email: dto.email,
              createdAt: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Tenant creation audit log error: ${e}`);
      }

      return { tenant, branch: centralBranch, owner: ownerUser };
    });

    this.logger.log(`🏢 Yeni Servis Kaydedildi -> ${result.tenant.title} (${result.tenant.slug}) - Yetkili: ${result.owner.name} ${result.owner.surname}`);

    return {
      success: true,
      message: 'Yeni servis kiracısı ve yetkili hesabı başarıyla oluşturuldu.',
      tenant: result.tenant,
      owner: {
        id: result.owner.id,
        name: result.owner.name,
        surname: result.owner.surname,
        phone: result.owner.phone,
        email: result.owner.email,
        role: result.owner.role,
      },
    };
  }

  /**
   * Servis (Tenant) Kalıcı Olarak Silme
   */
  async deleteTenant(tenantId: string, adminUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, title: true, slug: true },
    });

    if (!tenant) {
      throw new NotFoundException('Silinecek servis kaydı bulunamadı.');
    }

    await this.prisma.tenant.delete({
      where: { id: tenantId },
    });

    this.logger.warn(`🗑️ Servis ve ilişkili tüm verileri silindi: ${tenant.title} (${tenant.id}) - İşlemi yapan: ${adminUserId || 'Super Admin'}`);

    return {
      success: true,
      message: `"${tenant.title}" adlı servis ve bağlı tüm operasyonel verileri kalıcı olarak kaldırıldı.`,
    };
  }
}
