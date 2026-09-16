-- AlterTable
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "account_holder" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paytr_merchant_id" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paytr_merchant_key" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "paytr_merchant_salt" TEXT;
