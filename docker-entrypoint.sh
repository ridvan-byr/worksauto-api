#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL database connection..."
until npx prisma db push --skip-generate; do
  echo "PostgreSQL is not ready yet - retrying in 2 seconds..."
  sleep 2
done

echo "✅ Database schema synchronized."

echo "🌱 Checking/Applying initial seed data..."
node prisma/seed.cjs || echo "Seed completed."

echo "🚀 Starting WorksAuto API server..."
exec "$@"
