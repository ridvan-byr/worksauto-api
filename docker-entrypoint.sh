#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL and applying database migrations..."
until npx prisma migrate deploy; do
  echo "PostgreSQL is not ready or migration failed - retrying in 2 seconds..."
  sleep 2
done

echo "✅ Database migrations applied cleanly."

echo "🌱 Checking/Applying initial seed data..."
node prisma/seed.cjs || echo "Seed completed."

echo "🚀 Starting WorksAuto API server..."
exec "$@"
