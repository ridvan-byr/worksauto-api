-- Create Enum Types
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'COMPASSIONATE', 'UNPAID', 'OTHER');
CREATE TYPE "LeaveStatus" AS ENUM ('APPROVED', 'PENDING', 'CANCELLED');

-- Create staff_leaves table
CREATE TABLE "staff_leaves" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "leave_type" "LeaveType" NOT NULL DEFAULT 'ANNUAL',
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "total_days" DECIMAL(4,1) NOT NULL DEFAULT 1,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'APPROVED',
  "approved_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX "staff_leaves_tenant_id_start_date_end_date_idx" ON "staff_leaves"("tenant_id", "start_date", "end_date");
CREATE INDEX "staff_leaves_user_id_start_date_end_date_idx" ON "staff_leaves"("user_id", "start_date", "end_date");

-- Row Level Security (RLS)
ALTER TABLE "staff_leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_leaves" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON "staff_leaves" FOR ALL
USING (rls_bypassed() OR tenant_id::text = current_tenant_id())
WITH CHECK (rls_bypassed() OR tenant_id::text = current_tenant_id());

-- Grant table privileges to application runtime role
GRANT SELECT, INSERT, UPDATE, DELETE ON "staff_leaves" TO worksauto_app;
