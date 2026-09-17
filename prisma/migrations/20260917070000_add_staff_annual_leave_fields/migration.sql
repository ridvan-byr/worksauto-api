-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "default_annual_leave_days" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "annual_leave_days" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "transferred_leave_days" INTEGER NOT NULL DEFAULT 0;
