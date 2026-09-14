#!/usr/bin/env bash
set -euo pipefail
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgrespassword@localhost:5433/worksauto_remediation_test}"
node -e 'const name = new URL(process.env.DATABASE_URL).pathname.slice(1); if (!["worksauto_test", "worksauto_remediation_test", "worksauto_migration_test"].includes(name)) throw new Error("An isolated test database is required.");' 
export MIGRATION_DATABASE_URL="$DATABASE_URL"
export RUNTIME_DATABASE_PASSWORD=isolated_test_runtime_password_2026
export REDIS_HOST=localhost
export REDIS_PORT="${REDIS_PORT:-6380}"
export JWT_SECRET=isolated_test_jwt_secret_for_remediation_2026
export NODE_ENV=development
export ENABLE_DEV_OTP_BYPASS=true
export NOTIFICATION_DELIVERY_MODE=disabled
export CI=true
./node_modules/.bin/prisma migrate deploy
node scripts/provision-runtime-role.cjs
export RLS_DATABASE_URL="${RLS_DATABASE_URL:-${DATABASE_URL/postgres:postgrespassword/worksauto_app:$RUNTIME_DATABASE_PASSWORD}}"
export DATABASE_URL="$RLS_DATABASE_URL"
npm run test:e2e
