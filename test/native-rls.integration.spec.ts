import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

// Only the disposable database configured by verify-remediation.sh is accepted.
const url = process.env.RLS_DATABASE_URL;
if (
  !url ||
  !/^\/worksauto_(?:(?:remediation|migration)_)?test$/.test(
    new URL(url).pathname,
  )
) {
  throw new Error('RLS_DATABASE_URL must point to an isolated test database.');
}
describe('Runtime role tenant isolation', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const cls = new ClsService(new AsyncLocalStorage());
  const service = new PrismaService(cls);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  beforeAll(async () => {
    const [role] = await db.$queryRaw<
      Array<{ rolsuper: boolean; rolbypassrls: boolean }>
    >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
    await service.onModuleInit();
    for (const id of [tenantA, tenantB]) {
      await service.tenant.create({
        data: {
          id,
          slug: `rls-${id}`,
          title: 'RLS test',
          phone: '05523741500',
          email: 'ridvanemrebayar@gmail.com',
        },
      });
      await service.customer.create({
        data: {
          tenantId: id,
          firstName: 'RLS',
          lastName: 'Test',
          phone: '05523741500',
          email: 'ridvanemrebayar@gmail.com',
        },
      });
    }
  });
  afterAll(async () => {
    await service.customer.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await service.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await service.onModuleDestroy();
    await db.$disconnect();
  });
  it('denies direct queries with no database context', async () => {
    expect(await db.customer.findMany()).toEqual([]);
  });
  it('isolates regular delegates, interactive transactions and raw queries', async () => {
    await cls.run(async () => {
      cls.set('tenantId', tenantA);
      cls.set('userRole', 'TENANT_ADMIN');
      const rows = await service.customer.findMany();
      expect(rows.map((row) => row.tenantId)).toEqual([tenantA]);
      const raw = await service.$queryRaw<
        Array<{ tenant_id: string }>
      >`SELECT tenant_id FROM customers`;
      expect(raw.map((row) => row.tenant_id)).toEqual([tenantA]);
      const transactional = await service.$transaction((tx) =>
        tx.customer.findMany(),
      );
      expect(transactional.map((row) => row.tenantId)).toEqual([tenantA]);
      await expect(
        service.$transaction((tx) =>
          tx.customer.create({
            data: {
              tenantId: tenantB,
              firstName: 'Blocked',
              lastName: 'Test',
              phone: '05523741500',
            },
          }),
        ),
      ).rejects.toThrow();
    });
  });
  it('does not leak transaction settings into the pool', async () => {
    expect(await db.customer.findMany()).toEqual([]);
  });
});
