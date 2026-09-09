import { Injectable, OnModuleInit, OnModuleDestroy, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

const TENANT_SCOPED_MODELS = new Set([
  'WorkOrder',
  'Invoice',
  'Payment',
  'CurrentAccount',
  'CariMovement',
  'Vehicle',
  'Customer',
  'Product',
  'StockMovement',
  'Appointment',
  'Branch',
  'Mechanic',
  'Service',
  'IdempotencyRecord',
  'DocumentSequence',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({
            model,
            operation,
            args,
            query,
          }: {
            model?: string;
            operation: string;
            args: any;
            query: (args: any) => Promise<any>;
          }) {
            if (model && TENANT_SCOPED_MODELS.has(model)) {
              const tenantId = cls.get<string>('tenantId');
              const userRole = cls.get<string>('userRole');

              // Only enforce when a tenant request context is active and not super admin
              if (userRole !== 'SUPER_ADMIN' && tenantId) {
                if (['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                  args = args || {};
                  args.where = args.where || {};
                  if (args.where.tenantId && args.where.tenantId !== tenantId) {
                    throw new ForbiddenException(
                      `Çapraz kiracı erişim ihlali engellendi: ${model} modeli için yetkisiz tenantId tespiti.`,
                    );
                  }
                  args.where.tenantId = tenantId;
                }

                if (['updateMany', 'deleteMany'].includes(operation)) {
                  args = args || {};
                  args.where = args.where || {};
                  if (args.where.tenantId && args.where.tenantId !== tenantId) {
                    throw new ForbiddenException(
                      `Çapraz kiracı işlem ihlali engellendi: ${model} modeli için yetkisiz tenantId tespiti.`,
                    );
                  }
                  args.where.tenantId = tenantId;
                }

                if (operation === 'create') {
                  args = args || {};
                  args.data = args.data || {};
                  if (args.data.tenantId && args.data.tenantId !== tenantId) {
                    throw new ForbiddenException(
                      `Çapraz kiracı veri yazma ihlali: ${model} modeli için yetkisiz tenantId tespiti.`,
                    );
                  }
                  args.data.tenantId = tenantId;
                }

                if (operation === 'findUnique') {
                  const result = await query(args);
                  if (result && typeof result === 'object' && 'tenantId' in result && result.tenantId && result.tenantId !== tenantId) {
                    return null;
                  }
                  return result;
                }
              }
            }
            return query(args);
          },
        },
      },
    });

    Object.assign(this, extendedClient);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('PostgreSQL Prisma connection established with Multi-Tenant AST Guard.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL Prisma connection closed.');
  }
}
