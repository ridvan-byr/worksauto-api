-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "correlation_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");
