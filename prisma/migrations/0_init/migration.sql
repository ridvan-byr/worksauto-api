-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OWNER', 'SERVICE_MANAGER', 'TECHNICIAN', 'CASHIER', 'WAREHOUSE_KEEPER');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'LPG', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('QUEUE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderItemType" AS ENUM ('SERVICE', 'PART');

-- CreateEnum
CREATE TYPE "WorkOrderPhotoType" AS ENUM ('CHECKIN', 'DAMAGE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('OILS', 'FILTERS', 'BRAKES', 'IGNITION', 'SUSPENSION', 'GENERAL');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN_PURCHASE', 'OUT_WORK_ORDER', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'POS', 'BANK_TRANSFER', 'ONLINE');

-- CreateEnum
CREATE TYPE "CariReferenceType" AS ENUM ('INVOICE', 'PAYMENT', 'MANUAL_COLLECTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "legalName" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "auto_invoice_on_complete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isCentral" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "company_title" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_number" TEXT,
    "tax_office" TEXT,
    "credit_limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "engine_no" TEXT,
    "color" TEXT,
    "fuel_type" "FuelType" NOT NULL DEFAULT 'DIESEL',
    "transmission" "TransmissionType" NOT NULL DEFAULT 'MANUAL',
    "current_km" INTEGER NOT NULL DEFAULT 0,
    "inspection_valid_until" DATE,
    "insurance_valid_until" DATE,
    "kasko_valid_until" DATE,
    "deleted_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "default_duration_min" INTEGER NOT NULL DEFAULT 60,
    "base_price" DECIMAL(10,2) NOT NULL,
    "kdv_rate" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "specialty" TEXT NOT NULL,
    "assigned_lift" TEXT,
    "daily_capacity_hours" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "assigned_mechanic_id" UUID,
    "assigned_lift" TEXT,
    "slot_date" DATE NOT NULL,
    "slot_start_time" TIMESTAMPTZ(6) NOT NULL,
    "slot_end_time" TIMESTAMPTZ(6) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "customer_notes" TEXT,
    "cancellation_reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "work_order_number" TEXT NOT NULL,
    "appointment_id" UUID,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "assigned_mechanic_id" UUID,
    "assigned_lift" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'QUEUE',
    "initial_km" INTEGER NOT NULL DEFAULT 0,
    "fuel_level" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "kdv_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "item_type" "WorkOrderItemType" NOT NULL,
    "item_id" UUID,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "kdv_rate" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "total_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_photos" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "photo_type" "WorkOrderPhotoType" NOT NULL DEFAULT 'CHECKIN',
    "uploaded_by" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_notes" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "oem_code" TEXT NOT NULL,
    "barcode" TEXT,
    "category" "ProductCategory" NOT NULL DEFAULT 'GENERAL',
    "brand" TEXT NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock_level" INTEGER NOT NULL DEFAULT 5,
    "shelf_location" TEXT NOT NULL,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2) NOT NULL,
    "kdv_rate" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "deleted_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "shelf_id" UUID,
    "aisle" TEXT,
    "rack" TEXT,
    "tier" TEXT,
    "bin" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_id" TEXT,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "work_order_id" UUID,
    "customer_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "kdv_amount" DECIMAL(12,2) NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "e_invoice_uuid" TEXT,
    "e_invoice_status" TEXT,
    "gib_invoice_number" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID,
    "customer_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "payment_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashier_name" TEXT NOT NULL,
    "pos_slip_no" TEXT,
    "notes" TEXT,
    "gateway_provider" TEXT,
    "transaction_id" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "total_debits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_credits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "current_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cari_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "current_account_id" UUID NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "reference_type" "CariReferenceType" NOT NULL,
    "reference_no" TEXT,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "cari_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes_before" JSONB,
    "changes_after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_redaction_logs" (
    "id" UUID NOT NULL,
    "redacted_customer_id" UUID NOT NULL,
    "authorized_by_user_id" UUID NOT NULL,
    "legal_request_ref" TEXT NOT NULL,
    "affected_audit_log_ids" TEXT[],
    "previous_hash" TEXT NOT NULL,
    "current_hash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_redaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_code_key" ON "branches"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_tenant_id_phone_idx" ON "users"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "customers_tenant_id_deleted_at_idx" ON "customers"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "vehicles_tenant_id_deleted_at_idx" ON "vehicles"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_tenant_id_plate_key" ON "vehicles"("tenant_id", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "services_tenant_id_code_key" ON "services"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "mechanics_user_id_key" ON "mechanics"("user_id");

-- CreateIndex
CREATE INDEX "appointments_tenant_id_slot_date_idx" ON "appointments"("tenant_id", "slot_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_appointment_id_key" ON "work_orders"("appointment_id");

-- CreateIndex
CREATE INDEX "work_orders_tenant_id_status_idx" ON "work_orders"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_tenant_id_work_order_number_key" ON "work_orders"("tenant_id", "work_order_number");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_idx" ON "products"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "products_tenant_id_deleted_at_idx" ON "products"("tenant_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_oem_code_key" ON "products"("tenant_id", "oem_code");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_product_id_idx" ON "stock_movements"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_work_order_id_key" ON "invoices"("work_order_id");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE INDEX "payments_tenant_id_payment_date_idx" ON "payments"("tenant_id", "payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "current_accounts_customer_id_key" ON "current_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "cari_movements_tenant_id_current_account_id_idx" ON "cari_movements"("tenant_id", "current_account_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_name_entity_id_idx" ON "audit_logs"("tenant_id", "entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_createdAt_idx" ON "audit_logs"("tenant_id", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "compliance_redaction_logs_redacted_customer_id_idx" ON "compliance_redaction_logs"("redacted_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_key" ON "idempotency_records"("key");

-- CreateIndex
CREATE INDEX "idempotency_records_tenant_id_key_idx" ON "idempotency_records"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_is_read_idx" ON "notifications"("tenant_id", "user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_createdAt_idx" ON "notifications"("tenant_id", "createdAt");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_mechanic_id_fkey" FOREIGN KEY ("assigned_mechanic_id") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_mechanic_id_fkey" FOREIGN KEY ("assigned_mechanic_id") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_photos" ADD CONSTRAINT "work_order_photos_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_accounts" ADD CONSTRAINT "current_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_accounts" ADD CONSTRAINT "current_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_movements" ADD CONSTRAINT "cari_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cari_movements" ADD CONSTRAINT "cari_movements_current_account_id_fkey" FOREIGN KEY ("current_account_id") REFERENCES "current_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

