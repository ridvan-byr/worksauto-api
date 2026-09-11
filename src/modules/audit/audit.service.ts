import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

export interface CreateAuditLogParams {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  action: string;
  entityName: string;
  entityId: string;
  changesBefore?: any;
  changesAfter?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async log(params: CreateAuditLogParams) {
    try {
      const tenantId = params.tenantId || this.cls.get('tenantId') || undefined;
      const userId = params.userId || this.cls.get('userId') || undefined;
      const correlationId =
        params.correlationId || this.cls.getId() || undefined;

      return await this.prisma.auditLog.create({
        data: {
          tenantId: tenantId as string,
          userId,
          correlationId,
          action: params.action,
          entityName: params.entityName,
          entityId: params.entityId,
          changesBefore: params.changesBefore ?? undefined,
          changesAfter: params.changesAfter ?? undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (err) {
      console.error('Audit log creation failed:', err);
      return null;
    }
  }

  async findAll(
    tenantId: string,
    filters?: {
      entityName?: string;
      action?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 50));
    const skip = (page - 1) * limit;

    const andConditions: any[] = [
      { tenantId },
      {
        NOT: [
          { action: { startsWith: 'TENANT_' } },
          { action: { startsWith: 'SECURITY_' } },
        ],
      },
    ];

    if (filters?.entityName)
      andConditions.push({ entityName: filters.entityName });

    if (filters?.action) {
      if (filters.action === 'finance') {
        andConditions.push({
          OR: [
            { action: { startsWith: 'invoice' } },
            { action: { startsWith: 'payment' } },
          ],
        });
      } else {
        andConditions.push({
          action: { contains: filters.action, mode: 'insensitive' },
        });
      }
    }

    if (filters?.search) {
      const search = filters.search.trim();
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

      // 1. Aktör / Personel eşleşmesi (tenant scoped, tekil ve çok kelimeli)
      const userOrFilters: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { surname: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
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
        where: {
          tenantId,
          OR: userOrFilters,
        },
        select: { id: true },
        take: 50,
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      // 2. Müşteri eşleşmesi (tenant scoped)
      const matchingCustomers = await this.prisma.customer.findMany({
        where: {
          tenantId,
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
      const searchPattern = `%${search}%`;
      const matchingJsonRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM audit_logs 
        WHERE tenant_id = ${tenantId}::uuid 
          AND (CAST(changes_after AS TEXT) ILIKE ${searchPattern} OR CAST(changes_before AS TEXT) ILIKE ${searchPattern})
        LIMIT 100
      `;
      const matchingJsonIds = matchingJsonRows.map((r) => r.id);

      // Boşluksuz plaka araması da JSON içinde taranır (örn: 34abc789 -> 34 ABC 789)
      const cleanPlateQ = search.replace(/\s/g, '');
      if (cleanPlateQ.length >= 4 && cleanPlateQ !== search) {
        const cleanPlatePattern = `%${cleanPlateQ}%`;
        const plateJsonRows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM audit_logs 
          WHERE tenant_id = ${tenantId}::uuid 
            AND (CAST(changes_after AS TEXT) ILIKE ${cleanPlatePattern} OR CAST(changes_before AS TEXT) ILIKE ${cleanPlatePattern})
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

      andConditions.push({ OR: orConditions });
    }

    const where = { AND: andConditions };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const userIds = items.map((l) => l.userId).filter(Boolean) as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, surname: true, role: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = items.map((log) => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) || null : null,
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      data,
    };
  }
}
