import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('PostgreSQL Native Row-Level Security (RLS) Integration', () => {
  // Direct client connecting with NOBYPASSRLS application role
  const appDbUrl =
    'postgresql://worksauto_app:worksauto_secret_2026@localhost:5432/worksauto_db?schema=public';
  let prisma: PrismaClient;

  const TENANT_A = '13cf019b-9a00-4493-a68e-9c3049d8e878';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: appDbUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. should return 0 rows when queried without any tenant session context (default denied)', async () => {
    const customers = await prisma.customer.findMany({ take: 5 });
    expect(customers.length).toBe(0);
  });

  it('2. should return only Tenant A records when SET LOCAL app.current_tenant_id is Tenant A', async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${TENANT_A}'`,
      );
      return await tx.customer.findMany();
    });

    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.tenantId).toBe(TENANT_A);
    }
  });

  it('3. should isolate raw SQL queries without WHERE clause (PostgreSQL Engine enforces RLS)', async () => {
    const rawResult: any = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${TENANT_A}'`,
      );
      return await tx.$queryRawUnsafe(
        'SELECT count(*)::int as count FROM customers',
      );
    });

    const tenantACount = rawResult[0].count;
    expect(tenantACount).toBeGreaterThan(0);

    const emptyResult: any = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${TENANT_B}'`,
      );
      return await tx.$queryRawUnsafe(
        'SELECT count(*)::int as count FROM customers',
      );
    });

    expect(emptyResult[0].count).toBe(0);
  });

  it('4. should reject cross-tenant INSERT at PostgreSQL engine level', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${TENANT_A}'`,
        );
        // Attempt to insert record belonging to Tenant B while session is Tenant A
        await tx.$executeRawUnsafe(`
          INSERT INTO customers (id, tenant_id, first_name, last_name, phone, "updatedAt")
          VALUES (gen_random_uuid(), '${TENANT_B}', 'Malicious', 'Attempt', '5550009988', now())
        `);
      }),
    ).rejects.toThrow(/row-level security policy/i);
  });

  it('5. should allow super admin bypass when app.bypass_rls is on', async () => {
    const bypassedResult: any = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.bypass_rls = 'on'`);
      return await tx.$queryRawUnsafe(
        'SELECT count(*)::int as count FROM customers',
      );
    });

    expect(bypassedResult[0].count).toBeGreaterThan(0);
  });
});
