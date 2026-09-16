-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMPTZ(6);
