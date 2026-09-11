import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../../shared/infrastructure/redis/redis.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminMetricsService {
  private readonly logger = new Logger(AdminMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
   * Platform Geneli Güvenlik ve İşlem Audit Logları (Sayfalama ve Filtreleme Destekli)
   */
  async getAuditLogs(options?: {
    page?: number;
    limit?: number;
    action?: string;
    search?: string;
    tenantId?: string;
  }) {
    const page = Math.max(1, options?.page ? Number(options.page) : 1);
    const limit = Math.max(
      1,
      Math.min(100, options?.limit ? Number(options.limit) : 10),
    );

    const conditions: any[] = [];
    const actionFilter = options?.action || 'ALL';

    // 1. Destek modu (tenantId belirtilmişse o servisin loglarını getir; belirtilmemişse platform ve güvenlik loglarını getir)
    if (options?.tenantId) {
      conditions.push({ tenantId: options.tenantId });
    } else {
      // Platform & Güvenlik kapsamı (Servis içi gündelik operasyonlar KVKK ve kurumsal izolasyon gereği genel akıştan hariç tutulur)
      conditions.push({
        OR: [
          { action: { startsWith: 'TENANT_' } },
          { action: { startsWith: 'tenant.' } },
          { action: { startsWith: 'SECURITY_' } },
          { action: { startsWith: 'auth.' } },
          { action: { startsWith: 'admin.' } },
          { action: { startsWith: 'system.' } },
          { entityName: 'Tenant' },
          { entityName: 'AdminUser' },
          { entityName: 'SecurityAuth' },
        ],
      });
    }

    // 2. Kategori Filtreleri (Giriş Denemeleri vs Servis & Lisans)
    if (actionFilter === 'SECURITY') {
      conditions.push({
        OR: [
          { action: { startsWith: 'SECURITY_' } },
          { action: { startsWith: 'auth.' } },
          { action: { startsWith: 'security.' } },
          { entityName: 'SecurityAuth' },
        ],
      });
    } else if (actionFilter === 'TENANT') {
      conditions.push({
        OR: [
          { action: { startsWith: 'TENANT_' } },
          { action: { startsWith: 'tenant.' } },
          { entityName: 'Tenant' },
        ],
      });
    } else if (actionFilter !== 'ALL') {
      conditions.push({
        action: { contains: actionFilter, mode: 'insensitive' },
      });
    }

    if (options?.search) {
      const search = options.search.trim();
      const searchLower = search.toLowerCase();
      const actionKeywords: string[] = [search];
      if (searchLower.includes('fatura')) actionKeywords.push('invoice');
      if (searchLower.includes('randevu')) actionKeywords.push('appointment');
      if (searchLower.includes('iş emri') || searchLower.includes('is emri'))
        actionKeywords.push('work_order');
      if (searchLower.includes('hizmet')) actionKeywords.push('service');
      if (searchLower.includes('personel') || searchLower.includes('usta'))
        actionKeywords.push('staff', 'user');
      if (searchLower.includes('araç') || searchLower.includes('arac'))
        actionKeywords.push('vehicle');
      if (searchLower.includes('müşteri') || searchLower.includes('musteri'))
        actionKeywords.push('customer');
      if (searchLower.includes('ödeme') || searchLower.includes('tahsilat'))
        actionKeywords.push('payment');
      if (
        searchLower.includes('stok') ||
        searchLower.includes('parça') ||
        searchLower.includes('parca')
      )
        actionKeywords.push('inventory', 'product');
      if (searchLower.includes('lisans') || searchLower.includes('servis'))
        actionKeywords.push('tenant', 'status');

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
            {
              surname: {
                contains: nameParts.slice(1).join(' '),
                mode: 'insensitive',
              },
            },
          ],
        });
      }

      const matchingUsers = await this.prisma.user.findMany({
        where: { OR: userOrFilters },
        select: { id: true },
        take: 50,
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

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

      const searchPattern = `%${search}%`;
      const matchingJsonRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM audit_logs 
        WHERE (CAST(changes_after AS TEXT) ILIKE ${searchPattern} OR CAST(changes_before AS TEXT) ILIKE ${searchPattern})
        LIMIT 100
      `;
      const matchingJsonIds = matchingJsonRows.map((r) => r.id);

      const cleanPlateQ = search.replace(/\s/g, '');
      if (cleanPlateQ.length >= 4 && cleanPlateQ !== search) {
        const cleanPlatePattern = `%${cleanPlateQ}%`;
        const plateJsonRows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM audit_logs 
          WHERE (CAST(changes_after AS TEXT) ILIKE ${cleanPlatePattern} OR CAST(changes_before AS TEXT) ILIKE ${cleanPlatePattern})
          LIMIT 50
        `;
        for (const pr of plateJsonRows) {
          if (!matchingJsonIds.includes(pr.id)) matchingJsonIds.push(pr.id);
        }
      }

      const orConditions: any[] = [
        ...actionKeywords.map((kw) => ({
          action: { contains: kw, mode: 'insensitive' },
        })),
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

    const total = await this.prisma.auditLog.count({ where });
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.max(1, Math.min(page, totalPages));
    const safeSkip = (safePage - 1) * limit;

    const logs = await this.prisma.auditLog.findMany({
      where,
      take: limit,
      skip: safeSkip,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { title: true } },
      },
    });

    const userIds = logs.map((l) => l.userId).filter(Boolean) as string[];
    const users =
      userIds.length > 0
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
        page: safePage,
        limit,
        total,
        totalPages,
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
      status:
        dbStatus === 'HEALTHY' && redisStatus === 'HEALTHY'
          ? 'OPERATIONAL'
          : 'DEGRADED',
      database: { status: dbStatus, latencyMs: dbLatency },
      redis: { status: redisStatus },
      serverTimestamp: new Date().toISOString(),
    };
  }
}
