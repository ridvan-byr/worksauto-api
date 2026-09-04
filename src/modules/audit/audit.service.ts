import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

export interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
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
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
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
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters?.entityName) where.entityName = filters.entityName;
    if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }
}
