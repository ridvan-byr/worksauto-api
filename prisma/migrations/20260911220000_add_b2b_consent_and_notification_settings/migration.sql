-- CreateEnum
CREATE TYPE "NotificationStrategy" AS ENUM ('FALLBACK', 'BROADCAST', 'SINGLE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "b2b_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "b2b_consent_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "b2b_contract_version" TEXT NOT NULL DEFAULT '1.0';

-- CreateTable
CREATE TABLE "tenant_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "signed_by_user_id" UUID NOT NULL,
    "contract_version" TEXT NOT NULL DEFAULT '1.0',
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "verified_via" TEXT NOT NULL DEFAULT 'WEB_DIGITAL_SIGNATURE',
    "payload_hash" TEXT NOT NULL,
    "saas_terms_accepted" BOOLEAN NOT NULL DEFAULT true,
    "data_processing_accepted" BOOLEAN NOT NULL DEFAULT true,
    "marketing_accepted" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "strategy" "NotificationStrategy" NOT NULL DEFAULT 'FALLBACK',
    "channel_priority" "NotificationChannel"[] DEFAULT ARRAY['WHATSAPP', 'EMAIL', 'SMS']::"NotificationChannel"[],
    "single_channel" "NotificationChannel" DEFAULT 'WHATSAPP',
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_device_id" TEXT,
    "whatsapp_connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_consents_tenant_id_contract_version_idx" ON "tenant_consents"("tenant_id", "contract_version");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_notification_settings_tenant_id_key" ON "tenant_notification_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_consents" ADD CONSTRAINT "tenant_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_consents" ADD CONSTRAINT "tenant_consents_signed_by_user_id_fkey" FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_settings" ADD CONSTRAINT "tenant_notification_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable and Force RLS on new tenant tables
ALTER TABLE "tenant_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_consents" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "tenant_consents";
CREATE POLICY tenant_isolation_policy ON "tenant_consents"
  FOR ALL
  USING (
    rls_bypassed() OR tenant_id::text = current_tenant_id()
  )
  WITH CHECK (
    rls_bypassed() OR tenant_id::text = current_tenant_id()
  );

ALTER TABLE "tenant_notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_notification_settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "tenant_notification_settings";
CREATE POLICY tenant_isolation_policy ON "tenant_notification_settings"
  FOR ALL
  USING (
    rls_bypassed() OR tenant_id::text = current_tenant_id()
  )
  WITH CHECK (
    rls_bypassed() OR tenant_id::text = current_tenant_id()
  );

-- Auto-initialize notification settings for existing tenants
INSERT INTO "tenant_notification_settings" ("id", "tenant_id", "updatedAt")
SELECT gen_random_uuid(), "id", now() FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;
