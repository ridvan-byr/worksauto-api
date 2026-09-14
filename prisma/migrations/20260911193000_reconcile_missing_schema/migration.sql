-- CreateEnum
CREATE TYPE "InvoiceProviderType" AS ENUM ('INTERNAL', 'PARASUT', 'NILVERA', 'BIZIMHESAP', 'KOLAYBI', 'QNB_EFINANS');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ADVANCE_OFFSET';

-- DropForeignKey
ALTER TABLE "current_accounts" DROP CONSTRAINT "current_accounts_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "work_orders" DROP CONSTRAINT "work_orders_vehicle_id_fkey";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoice_type_code" TEXT DEFAULT 'SATIS',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "profile_id" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "shelf_cell_id" UUID;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "active_lift_count" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "appointment_slot_duration" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "break_end_time" TEXT DEFAULT '13:30',
ADD COLUMN     "break_start_time" TEXT DEFAULT '12:30',
ADD COLUMN     "critical_stock_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "work_end_time" TEXT NOT NULL DEFAULT '18:30',
ADD COLUMN     "work_start_time" TEXT NOT NULL DEFAULT '08:30',
ADD COLUMN     "working_days" TEXT[] DEFAULT ARRAY['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']::TEXT[];

-- AlterTable
ALTER TABLE "work_order_notes" ADD COLUMN     "author_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "work_order_photos" ADD COLUMN     "updated_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "warehouse_shelves" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zone" TEXT,
    "rows" INTEGER NOT NULL DEFAULT 4,
    "columns" INTEGER NOT NULL DEFAULT 5,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_cells" (
    "id" UUID NOT NULL,
    "shelf_id" UUID NOT NULL,
    "cell_code" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "col_number" INTEGER NOT NULL,
    "barcode" TEXT,
    "max_capacity" INTEGER,

    CONSTRAINT "shelf_cells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "item_type" "WorkOrderItemType" NOT NULL DEFAULT 'SERVICE',
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "kdv_rate" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "total_price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "is_granted" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "channel" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "policy_version" TEXT NOT NULL DEFAULT '1.0',
    "verification_token" TEXT,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_bays" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_available_for_online" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workshop_bays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invoice_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "InvoiceProviderType" NOT NULL DEFAULT 'INTERNAL',
    "encrypted_api_key" TEXT,
    "encrypted_api_secret" TEXT,
    "encrypted_username" TEXT,
    "encrypted_password" TEXT,
    "company_tax_id" TEXT,
    "tax_office" TEXT,
    "series_prefix" TEXT DEFAULT 'ATW',
    "is_test_mode" BOOLEAN NOT NULL DEFAULT false,
    "auto_send_on_completion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_shelves_tenant_id_idx" ON "warehouse_shelves"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_shelves_tenant_id_code_key" ON "warehouse_shelves"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "shelf_cells_shelf_id_idx" ON "shelf_cells"("shelf_id");

-- CreateIndex
CREATE UNIQUE INDEX "shelf_cells_shelf_id_cell_code_key" ON "shelf_cells"("shelf_id", "cell_code");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_tenant_id_doc_type_year_key" ON "document_sequences"("tenant_id", "doc_type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "customer_consents_verification_token_key" ON "customer_consents"("verification_token");

-- CreateIndex
CREATE INDEX "customer_consents_tenant_id_customer_id_idx" ON "customer_consents"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_consents_verification_token_idx" ON "customer_consents"("verification_token");

-- CreateIndex
CREATE INDEX "workshop_bays_tenant_id_idx" ON "workshop_bays"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_bays_tenant_id_name_key" ON "workshop_bays"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invoice_settings_tenant_id_key" ON "tenant_invoice_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shelf_cell_id_fkey" FOREIGN KEY ("shelf_cell_id") REFERENCES "shelf_cells"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_shelves" ADD CONSTRAINT "warehouse_shelves_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_cells" ADD CONSTRAINT "shelf_cells_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "warehouse_shelves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_accounts" ADD CONSTRAINT "current_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_bays" ADD CONSTRAINT "workshop_bays_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invoice_settings" ADD CONSTRAINT "tenant_invoice_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
