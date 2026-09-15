import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'node:async_hooks';

// Shared by PrismaService instances so an audit/service call participates in the
// caller's transaction instead of opening an independent connection.
const transactions = new AsyncLocalStorage<{
  tx: any;
  tenantId: string | null;
}>();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly database: PrismaClient;

  constructor(private readonly cls: ClsService) {
    super();
    const database = new PrismaClient({ log: ['error'] });
    this.database = database;
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegateName =
        model.name.charAt(0).toLowerCase() + model.name.slice(1);
      const tenantScoped = model.fields.some(
        (field) => field.name === 'tenantId',
      );
      Object.defineProperty(this, delegateName, {
        value: new Proxy(
          {},
          {
            get: (_target, operation: string) => (input: any) => {
              const args = input ? { ...input } : {};
              const tenantId = this.tenantId();
              if (tenantScoped && tenantId) {
                if (
                  [
                    'findUnique',
                    'findUniqueOrThrow',
                    'findFirst',
                    'findFirstOrThrow',
                    'findMany',
                    'count',
                    'aggregate',
                    'groupBy',
                    'update',
                    'updateMany',
                    'delete',
                    'deleteMany',
                    'upsert',
                  ].includes(operation)
                ) {
                  if (args.where?.tenantId && args.where.tenantId !== tenantId)
                    throw new ForbiddenException(
                      'Cross-tenant access is not allowed.',
                    );
                  args.where = { ...args.where, tenantId };
                }
                if (
                  ['update', 'updateMany', 'upsert'].includes(operation) &&
                  args.data?.tenantId &&
                  args.data.tenantId !== tenantId
                ) {
                  throw new ForbiddenException(
                    'Cross-tenant writes are not allowed.',
                  );
                }
                if (operation === 'create') {
                  if (args.data?.tenantId && args.data.tenantId !== tenantId)
                    throw new ForbiddenException(
                      'Cross-tenant writes are not allowed.',
                    );
                  args.data = { ...args.data, tenantId };
                }
              }
              return this.inContext((tx) => tx[delegateName][operation](args));
            },
          },
        ),
      });
    }
    for (const method of [
      '$queryRaw',
      '$queryRawUnsafe',
      '$executeRaw',
      '$executeRawUnsafe',
    ]) {
      Object.defineProperty(this, method, {
        value: (...args: any[]) => this.inContext((tx) => tx[method](...args)),
      });
    }
    Object.defineProperty(this, '$transaction', {
      value: (callback: any, options?: any) => {
        if (typeof callback !== 'function')
          throw new Error(
            'Use an interactive transaction callback for tenant-scoped operations.',
          );
        return this.inContext(callback, undefined, options);
      },
    });
  }

  private tenantId(): string | null {
    return this.cls.isActive() && this.cls.get('userRole') !== 'SUPER_ADMIN'
      ? this.cls.get<string>('tenantId') || null
      : null;
  }

  private async inContext<T>(
    callback: (tx: any) => Promise<T>,
    explicitTenant?: string | null,
    options?: any,
  ): Promise<T> {
    const tenantId =
      explicitTenant === undefined ? this.tenantId() : explicitTenant;
    const active = transactions.getStore();
    if (active) {
      if (active.tenantId !== tenantId)
        throw new ForbiddenException(
          'Cannot change tenant inside a transaction.',
        );
      return callback(active.tx);
    }
    return this.database.$transaction(
      async (tx) => {
        // Tenant-free calls are reserved for authenticated control-plane and
        // explicitly public application flows (login, booking and signed links).
        await tx.$queryRaw`SELECT set_config('app.current_tenant_id', ${tenantId || ''}, true), set_config('app.bypass_rls', ${tenantId ? 'off' : 'on'}, true)`;
        return transactions.run({ tx, tenantId }, () => callback(tx));
      },
      { maxWait: 10000, timeout: 15000, ...options },
    );
  }

  async onModuleInit() {
    await this.database.$connect();
    if (process.env.NODE_ENV === 'production') {
      const roles = await this.database.$queryRaw<
        Array<{ rolsuper: boolean; rolbypassrls: boolean }>
      >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      if (roles[0]?.rolsuper || roles[0]?.rolbypassrls)
        throw new Error(
          'Production DATABASE_URL must use a NOSUPERUSER NOBYPASSRLS role.',
        );
    }
    this.logger.log(
      'Database connected with transaction-scoped tenant context.',
    );
  }

  async onModuleDestroy() {
    await this.database.$disconnect();
  }

  async withTenantContext<T>(
    tenantId: string | null | undefined,
    fn: (tx: any) => Promise<T>,
  ): Promise<T> {
    return this.inContext(fn, tenantId || null);
  }
}
