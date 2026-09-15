#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL and applying database migrations..."
DATABASE_URL="${MIGRATION_DATABASE_URL:-$DATABASE_URL}" npx prisma migrate deploy
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  node scripts/provision-runtime-role.cjs
fi

echo "✅ Database migrations applied cleanly."

if [ "$NODE_ENV" != "production" ] || [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Checking/Applying initial seed data..."
  DATABASE_URL="${MIGRATION_DATABASE_URL:-$DATABASE_URL}" node prisma/seed.cjs
else
  echo "🔒 Production mode detected: Automated database seeding skipped for security hardening."
fi

echo "🚀 Starting WorksAuto API server..."
exec "$@"
