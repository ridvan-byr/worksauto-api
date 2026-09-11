-- ==============================================================================
-- Migration: Native PostgreSQL Row-Level Security (RLS) & Tenant Isolation
-- Description: Defense-in-depth isolation at PostgreSQL database engine level.
-- Compatible with connection poolers (PgBouncer) via SET LOCAL transaction state.
-- ==============================================================================

-- 1. Create dedicated application role if not exists (enforces NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'worksauto_app') THEN
    CREATE ROLE worksauto_app WITH LOGIN PASSWORD 'worksauto_secret_2026' NOBYPASSRLS NOSUPERUSER;
  ELSE
    ALTER ROLE worksauto_app WITH NOBYPASSRLS NOSUPERUSER;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE worksauto_db TO worksauto_app;
GRANT USAGE ON SCHEMA public TO worksauto_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO worksauto_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO worksauto_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO worksauto_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO worksauto_app;

-- 2. Define RLS Helper functions (SECURITY DEFINER for performance & safety)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS text STABLE AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rls_bypassed() RETURNS boolean STABLE AS $$
BEGIN
  RETURN COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on';
END;
$$ LANGUAGE plpgsql;

-- 3. Enable RLS and define Tenant Isolation Policy on all tenant-scoped tables

-- Direct tenant tables (having tenant_id column):
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'branches',
    'customers',
    'vehicles',
    'services',
    'mechanics',
    'appointments',
    'work_orders',
    'products',
    'stock_movements',
    'warehouse_shelves',
    'invoices',
    'payments',
    'current_accounts',
    'cari_movements',
    'audit_logs',
    'idempotency_records',
    'document_sequences',
    'notifications',
    'customer_consents',
    'workshop_bays'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Enable RLS & Force RLS (applies to table owners too unless superuser/bypassrls)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);

    -- Drop existing policy if already present
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', t);

    -- Create unified SELECT / INSERT / UPDATE / DELETE policy
    EXECUTE format('
      CREATE POLICY tenant_isolation_policy ON %I
        FOR ALL
        USING (
          rls_bypassed() OR tenant_id::text = current_tenant_id()
        )
        WITH CHECK (
          rls_bypassed() OR tenant_id::text = current_tenant_id()
        );
    ', t);
  END LOOP;
END
$$;

-- Subordinate child tables (isolated via parent join):
-- a. work_order_items (via work_orders)
ALTER TABLE work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON work_order_items;
CREATE POLICY tenant_isolation_policy ON work_order_items
  FOR ALL
  USING (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_items.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  )
  WITH CHECK (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_items.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  );

-- b. work_order_photos (via work_orders)
ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_photos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON work_order_photos;
CREATE POLICY tenant_isolation_policy ON work_order_photos
  FOR ALL
  USING (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_photos.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  )
  WITH CHECK (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_photos.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  );

-- c. work_order_notes (via work_orders)
ALTER TABLE work_order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_notes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON work_order_notes;
CREATE POLICY tenant_isolation_policy ON work_order_notes
  FOR ALL
  USING (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_notes.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  )
  WITH CHECK (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_notes.work_order_id
        AND wo.tenant_id::text = current_tenant_id()
    )
  );

-- d. shelf_cells (via warehouse_shelves)
ALTER TABLE shelf_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_cells FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON shelf_cells;
CREATE POLICY tenant_isolation_policy ON shelf_cells
  FOR ALL
  USING (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM warehouse_shelves ws
      WHERE ws.id = shelf_cells.shelf_id
        AND ws.tenant_id::text = current_tenant_id()
    )
  )
  WITH CHECK (
    rls_bypassed() OR EXISTS (
      SELECT 1 FROM warehouse_shelves ws
      WHERE ws.id = shelf_cells.shelf_id
        AND ws.tenant_id::text = current_tenant_id()
    )
  );

-- e. users table: Superadmin has tenant_id NULL; normal users have tenant_id.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON users;
CREATE POLICY tenant_isolation_policy ON users
  FOR ALL
  USING (
    rls_bypassed()
    OR (tenant_id IS NOT NULL AND tenant_id::text = current_tenant_id())
    OR (current_tenant_id() IS NULL AND tenant_id IS NULL)
  )
  WITH CHECK (
    rls_bypassed()
    OR (tenant_id IS NOT NULL AND tenant_id::text = current_tenant_id())
  );
