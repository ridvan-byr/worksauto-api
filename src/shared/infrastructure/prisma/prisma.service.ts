import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly cls: ClsService) {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('PostgreSQL Prisma connection established successfully.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('PostgreSQL Prisma connection closed.');
  }

  /**
   * Executes a transaction with PostgreSQL RLS tenant context enforced
   */
  async withTenantContext<T>(tenantId: string, fn: (tx: any) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, true);`,
        tenantId,
      );
      return fn(tx);
    });
  }
}
