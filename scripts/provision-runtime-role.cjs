const { PrismaClient } = require('@prisma/client');

async function main() {
  const password = process.env.RUNTIME_DATABASE_PASSWORD;
  if (!password || password.length < 24) throw new Error('RUNTIME_DATABASE_PASSWORD must contain at least 24 characters.');
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required.');
  const db = new PrismaClient({ datasources: { db: { url: process.env.MIGRATION_DATABASE_URL } } });
  try {
    const [{ statement }] = await db.$queryRaw`SELECT format('ALTER ROLE worksauto_app WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', ${password}) AS statement`;
    await db.$executeRawUnsafe(statement);
    await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO worksauto_app');
    await db.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worksauto_app');
    await db.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worksauto_app');
    console.log('Runtime database role provisioned.');
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Runtime database role provisioning failed. Check migration credentials and password configuration.'); process.exitCode = 1; });
