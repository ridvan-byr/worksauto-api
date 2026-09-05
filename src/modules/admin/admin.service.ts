import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Super Admin E-Posta & Şifre ile Doğrulama (IP & UserAgent Güvenlik Kayıtlı)
   */
  async login(dto: AdminLoginDto, ipAddress?: string, userAgent?: string) {
    const emailNormalized = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email: emailNormalized,
        isActive: true,
      },
    });

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: null,
            userId: null,
            action: 'SECURITY_LOGIN_FAILED',
            entityName: 'SecurityAuth',
            entityId: 'unauthorized',
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            changesAfter: {
              attemptedEmail: emailNormalized,
              reason: 'Bilinmeyen e-posta veya yetkisiz erişim denemesi.',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Security audit log failure: ${e}`);
      }
      throw new UnauthorizedException('Geçersiz yönetici kimlik bilgileri veya yetkisiz hesap.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Bu hesap için parola tanımlanmamıştır.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: null,
            userId: user.id,
            action: 'SECURITY_LOGIN_FAILED',
            entityName: 'SecurityAuth',
            entityId: user.id,
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            changesAfter: {
              attemptedEmail: emailNormalized,
              reason: 'Hatalı şifre girişi.',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Security audit log failure: ${e}`);
      }
      throw new UnauthorizedException('Girdiğiniz şifre hatalı.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: null,
          userId: user.id,
          action: 'SECURITY_LOGIN_SUCCESS',
          entityName: 'SecurityAuth',
          entityId: user.id,
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: userAgent || 'Unknown',
          changesAfter: {
            email: user.email,
            status: 'SESSION_INITIALIZED',
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Security audit log failure: ${e}`);
    }

    this.logger.log(`👑 Super Admin console access granted: ${user.email} (IP: ${ipAddress})`);

    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Platform Geneli Özet Metrikler (SaaS KPI)
   */
  async getStats() {
    const [
      totalTenants,
      activeTenants,
      inactiveTenants,
      totalWorkOrders,
      totalCustomers,
      totalMechanics,
      revenueResult,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenant.count({ where: { isActive: false } }),
      this.prisma.workOrder.count(),
      this.prisma.customer.count(),
      this.prisma.user.count({ where: { role: UserRole.TECHNICIAN } }),
      this.prisma.workOrder.aggregate({
        _sum: { grandTotal: true },
        where: { status: 'COMPLETED' },
      }),
    ]);

    const totalPlatformVolume = Number(revenueResult._sum.grandTotal || 0);

    return {
      totalTenants,
      activeTenants,
      inactiveTenants,
      totalWorkOrders,
      totalCustomers,
      totalMechanics,
      totalPlatformVolume,
    };
  }

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

    // Audit Log kaydı oluştur
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

    // Telefon numarasıyla mevcut kullanıcı kontrolü
    const existingUser = await this.prisma.user.findFirst({
      where: { phone: formattedPhone },
    });
    if (existingUser) {
      throw new BadRequestException(`Bu telefon numarası (${formattedPhone}) ile kayıtlı bir kullanıcı zaten mevcut.`);
    }

    // Slug üretimi (Türkçe karakterleri ve boşlukları dönüştür)
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

    // Prisma Transaction: Tenant + Merkez Şube + Owner User + Audit Log
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

    // Cascade delete via Prisma
    await this.prisma.tenant.delete({
      where: { id: tenantId },
    });

    this.logger.warn(`🗑️ Servis ve ilişkili tüm verileri silindi: ${tenant.title} (${tenant.id}) - İşlemi yapan: ${adminUserId || 'Super Admin'}`);

    return {
      success: true,
      message: `"${tenant.title}" adlı servis ve bağlı tüm operasyonel verileri kalıcı olarak kaldırıldı.`,
    };
  }

  /**
   * Platform Geneli Güvenlik ve İşlem Audit Logları (Sayfalama ve Filtreleme Destekli)
   */
  async getAuditLogs(options?: {
    page?: number;
    limit?: number;
    action?: string;
    search?: string;
  }) {
    const page = Math.max(1, options?.page ? Number(options.page) : 1);
    const limit = Math.max(1, Math.min(100, options?.limit ? Number(options.limit) : 10));
    const skip = (page - 1) * limit;

    const conditions: any[] = [];
    const hasSearch = Boolean(options?.search?.trim());
    const actionFilter = options?.action || (hasSearch ? 'ALL' : 'PLATFORM');

    if (actionFilter && actionFilter !== 'ALL') {
      if (actionFilter === 'PLATFORM') {
        conditions.push({
          OR: [
            { action: { startsWith: 'TENANT_' } },
            { action: { startsWith: 'SECURITY_' } },
          ],
        });
      } else if (actionFilter === 'TENANT') {
        conditions.push({ action: { startsWith: 'TENANT_' } });
      } else if (actionFilter === 'SECURITY') {
        conditions.push({ action: { startsWith: 'SECURITY_' } });
      } else if (actionFilter === 'OPERATIONS') {
        conditions.push({
          OR: [
            { action: { startsWith: 'work_order' } },
            { action: { startsWith: 'appointment' } },
            { action: { startsWith: 'service' } },
            { action: { startsWith: 'invoice' } },
            { action: { startsWith: 'payment' } },
          ],
        });
      } else {
        conditions.push({ action: { contains: actionFilter, mode: 'insensitive' } });
      }
    }

    if (options?.search) {
      const search = options.search.trim();
      const searchLower = search.toLowerCase();
      const actionKeywords: string[] = [search];
      if (searchLower.includes('fatura')) actionKeywords.push('invoice');
      if (searchLower.includes('randevu')) actionKeywords.push('appointment');
      if (searchLower.includes('iş emri') || searchLower.includes('is emri')) actionKeywords.push('work_order');
      if (searchLower.includes('hizmet')) actionKeywords.push('service');
      if (searchLower.includes('personel') || searchLower.includes('usta')) actionKeywords.push('staff', 'user');
      if (searchLower.includes('araç') || searchLower.includes('arac')) actionKeywords.push('vehicle');
      if (searchLower.includes('müşteri') || searchLower.includes('musteri')) actionKeywords.push('customer');
      if (searchLower.includes('ödeme') || searchLower.includes('tahsilat')) actionKeywords.push('payment');
      if (searchLower.includes('stok') || searchLower.includes('parça') || searchLower.includes('parca')) actionKeywords.push('inventory', 'product');
      if (searchLower.includes('lisans') || searchLower.includes('servis')) actionKeywords.push('tenant', 'status');

      // 1. Aktör/Kullanıcı eşleşmesi (tekil ve çok kelimeli)
      const userOrFilters: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { surname: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
      const nameParts = search.split(/\s+/).filter(Boolean);
      if (nameParts.length >= 2) {
        userOrFilters.push({
          AND: [
            { name: { contains: nameParts[0], mode: 'insensitive' } },
            { surname: { contains: nameParts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        });
      }

      const matchingUsers = await this.prisma.user.findMany({
        where: { OR: userOrFilters },
        select: { id: true },
        take: 50,
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      // 2. Müşteri eşleşmesi
      const matchingCustomers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { companyTitle: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      const matchingCustomerIds = matchingCustomers.map((c) => c.id);

      // 3. JSON Payload (changes_after & changes_before) Derin Arama
      const matchingJsonRows: { id: string }[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM audit_logs 
         WHERE (CAST(changes_after AS TEXT) ILIKE $1 OR CAST(changes_before AS TEXT) ILIKE $1)
         LIMIT 100`,
        `%${search}%`
      );
      const matchingJsonIds = matchingJsonRows.map((r) => r.id);

      // Boşluksuz plaka araması da JSON içinde taranır (örn: 34abc789 -> 34 ABC 789)
      const cleanPlateQ = search.replace(/\s/g, '');
      if (cleanPlateQ.length >= 4 && cleanPlateQ !== search) {
        const plateJsonRows: { id: string }[] = await this.prisma.$queryRawUnsafe(
          `SELECT id FROM audit_logs 
           WHERE (CAST(changes_after AS TEXT) ILIKE $1 OR CAST(changes_before AS TEXT) ILIKE $1)
           LIMIT 50`,
          `%${cleanPlateQ}%`
        );
        for (const pr of plateJsonRows) {
          if (!matchingJsonIds.includes(pr.id)) matchingJsonIds.push(pr.id);
        }
      }

      const orConditions: any[] = [
        ...actionKeywords.map((kw) => ({ action: { contains: kw, mode: 'insensitive' } })),
        { entityName: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search } },
        { userAgent: { contains: search, mode: 'insensitive' } },
        { tenant: { title: { contains: search, mode: 'insensitive' } } },
      ];

      if (matchingUserIds.length > 0) {
        orConditions.push({ userId: { in: matchingUserIds } });
      }

      if (matchingCustomerIds.length > 0) {
        orConditions.push({ entityId: { in: matchingCustomerIds } });
      }

      if (matchingJsonIds.length > 0) {
        orConditions.push({ id: { in: matchingJsonIds } });
      }

      conditions.push({ OR: orConditions });
    }

    const where: any = conditions.length > 0 ? { AND: conditions } : {};

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { title: true } },
        },
      }),
    ]);

    const userIds = logs.map((l) => l.userId).filter(Boolean) as string[];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, surname: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = logs.map((log) => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) || null : null,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Sistem Sağlık Kontrolü (PostgreSQL, Redis)
   */
  async getSystemHealth() {
    const startTime = Date.now();
    let dbStatus = 'HEALTHY';
    let dbLatency = 0;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - startTime;
    } catch {
      dbStatus = 'DOWN';
    }

    let redisStatus = 'HEALTHY';
    try {
      const ping = await this.redis.get('health_check');
      if (ping === null) {
        await this.redis.set('health_check', 'ok', 60);
      }
    } catch {
      redisStatus = 'DOWN';
    }

    return {
      status: dbStatus === 'HEALTHY' && redisStatus === 'HEALTHY' ? 'OPERATIONAL' : 'DEGRADED',
      database: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus },
      serverTimestamp: new Date().toISOString(),
    };
  }
}
