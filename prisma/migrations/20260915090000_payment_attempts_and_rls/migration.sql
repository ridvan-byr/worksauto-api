CREATE TABLE "payment_attempts" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_id" UUID NOT NULL REFERENCES "invoices"("id") ON DELETE RESTRICT,
  "amount" DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "payment_attempts_tenant_id_invoice_id_idx" ON "payment_attempts"("tenant_id", "invoice_id");
CREATE UNIQUE INDEX "payments_tenant_id_gateway_provider_transaction_id_key"
ON "payments"("tenant_id", "gateway_provider", "transaction_id");

UPDATE "payments" SET "payment_method" = 'ADVANCE_OFFSET'
WHERE "cashier_name" = 'Sistem (Cari Avans Mahsubu)' AND "payment_method" = 'ONLINE';

ALTER TABLE "payment_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "payment_attempts" FOR ALL
USING (rls_bypassed() OR tenant_id::text = current_tenant_id())
WITH CHECK (rls_bypassed() OR tenant_id::text = current_tenant_id());

ALTER TABLE "tenant_invoice_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_invoice_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "tenant_invoice_settings" FOR ALL
USING (rls_bypassed() OR tenant_id::text = current_tenant_id())
WITH CHECK (rls_bypassed() OR tenant_id::text = current_tenant_id());

ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "invoice_items" FOR ALL
USING (rls_bypassed() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id::text = current_tenant_id()))
WITH CHECK (rls_bypassed() OR EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.tenant_id::text = current_tenant_id()));

-- Align database exclusion rules with the application's released NO_SHOW slots.
ALTER TABLE appointments DROP CONSTRAINT no_overlapping_mechanic;
ALTER TABLE appointments DROP CONSTRAINT no_overlapping_lift;
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_mechanic EXCLUDE USING gist
(tenant_id WITH =, assigned_mechanic_id WITH =, tstzrange(slot_start_time, slot_end_time) WITH &&)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW') AND assigned_mechanic_id IS NOT NULL);
ALTER TABLE appointments ADD CONSTRAINT no_overlapping_lift EXCLUDE USING gist
(tenant_id WITH =, assigned_lift WITH =, tstzrange(slot_start_time, slot_end_time) WITH &&)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW') AND assigned_lift IS NOT NULL);
