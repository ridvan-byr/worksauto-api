-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "customer_rating" INTEGER,
ADD COLUMN IF NOT EXISTS "customer_comment" TEXT,
ADD COLUMN IF NOT EXISTS "customer_rated_at" TIMESTAMPTZ(6);
