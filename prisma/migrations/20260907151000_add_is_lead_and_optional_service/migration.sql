-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_service_id_fkey";

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "service_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_lead" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
