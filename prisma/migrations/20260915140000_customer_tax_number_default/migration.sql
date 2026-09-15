-- Set default '11111111111' on customers.tax_number
ALTER TABLE "customers" ALTER COLUMN "tax_number" SET DEFAULT '11111111111';

-- Backfill all existing customers with null or empty tax_number
UPDATE "customers"
SET "tax_number" = '11111111111'
WHERE "tax_number" IS NULL OR TRIM("tax_number") = '';
