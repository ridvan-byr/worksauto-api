-- Enable btree_gist extension for GiST index on scalar types (UUID, text)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enforce zero-collision dual exclusion constraint on mechanic double-booking
ALTER TABLE "appointments"
ADD CONSTRAINT "no_overlapping_mechanic"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "assigned_mechanic_id" WITH =,
  tstzrange("slot_start_time", "slot_end_time") WITH &&
)
WHERE ("status" NOT IN ('CANCELLED') AND "assigned_mechanic_id" IS NOT NULL);

-- Enforce zero-collision dual exclusion constraint on lift double-booking
ALTER TABLE "appointments"
ADD CONSTRAINT "no_overlapping_lift"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "assigned_lift" WITH =,
  tstzrange("slot_start_time", "slot_end_time") WITH &&
)
WHERE ("status" NOT IN ('CANCELLED') AND "assigned_lift" IS NOT NULL);
