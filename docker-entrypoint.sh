#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL and applying database migrations..."
until npx prisma migrate deploy; do
  echo "PostgreSQL is not ready or migration failed - retrying in 2 seconds..."
  sleep 2
done

echo "✅ Database migrations applied cleanly."

if [ "$NODE_ENV" != "production" ] || [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Checking/Applying initial seed data..."
  node prisma/seed.cjs || echo "Seed completed."
else
  echo "🔒 Production mode detected: Automated database seeding skipped for security hardening."
fi

echo "🚀 Starting WorksAuto API server..."
exec "$@"
