<div align="center">

  <img src="assets/brand/worksauto-logo-dark.png#gh-light-mode-only" alt="WorksAuto Logo" width="340" />
  <img src="assets/brand/worksauto-logo-white.png#gh-dark-mode-only" alt="WorksAuto Logo" width="340" />

  <p align="center">
    <strong>Enterprise-Grade Multi-Tenant Auto Service & Workshop Backend Core</strong>
  </p>

  <p align="center">
    <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-11.x-ea2845?style=for-the-badge&logo=nestjs" alt="NestJS" /></a>
    <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-16_RLS-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" /></a>
    <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-6.x-2d3748?style=for-the-badge&logo=prisma" alt="Prisma" /></a>
    <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-7_BullMQ-dc382d?style=for-the-badge&logo=redis" alt="Redis" /></a>
    <a href="https://min.io"><img src="https://img.shields.io/badge/MinIO-S3_Storage-c72c48?style=for-the-badge&logo=minio" alt="MinIO" /></a>
    <a href="https://swagger.io"><img src="https://img.shields.io/badge/Swagger-OpenAPI_3.0-85ea2d?style=for-the-badge&logo=swagger" alt="Swagger" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" /></a>
  </p>

  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-architecture--clean-architecture-boundaries">Architecture</a> •
    <a href="#-key-enterprise-safeguards">Safeguards</a> •
    <a href="#-database-schema-prisma">Database Schema</a> •
    <a href="#-api-endpoints-matrix">API Matrix</a> •
    <a href="#-testing--quality-gate">Quality Gate</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-author">Author</a>
  </p>

</div>

---

## 🚀 About the Project

**WorksAuto API** is the mission-critical core backend engine for the WorksAuto multi-tenant automotive repair shop and dealership management SaaS platform.

Engineered with **Clean Architecture + Domain-Driven Design (DDD)**, multi-tenant application-layer isolation, and native PostgreSQL exclusion constraints, it provides financial accuracy, real-time garage bay synchronization, atomic stock decrements, warehouse 2D shelf matrix management, and automated regulatory compliance (KVKK / GDPR / VUK).

---

## 🏛️ Architecture & Clean Architecture Boundaries

The application strictly adheres to the Clean Architecture dependency inversion principle (`Presentation` → `Application` → `Domain` ← `Infrastructure`):

```
worksauto-api/
├── prisma/
│   └── schema.prisma           # 27 Domain Models with multi-tenant compound indices
├── src/
│   ├── modules/
│   │   ├── admin/              # Super Admin root console, tenant licensing & platform metrics
│   │   ├── auth/               # JWT, Refresh Token Rotation, Reuse Detection & Tenant Context
│   │   ├── customers/          # CRM, KVKK Anonymization & IYS Customer Consent Ledger
│   │   ├── vehicles/           # Plate & VIN uniqueness validation, vehicle history
│   │   ├── appointments/       # Dual-collision prevention (Mechanic & Lift double-booking)
│   │   ├── inventory/          # Atomic conditional stock decrements & 2D Shelf Matrix
│   │   ├── work-orders/        # Service orders, part usage, labor & status rollback engine
│   │   ├── invoices/           # VUK 10-year immutable invoicing & sequence numbering
│   │   ├── payments/           # Settlement processing & cashier daily closing registers
│   │   ├── current-accounts/   # Customer ledger, running balances & statement syncing
│   │   ├── audit/              # Immutable security & operations audit trail
│   │   └── notifications/      # BullMQ background workers & real-time socket events
│   ├── shared/
│   │   ├── decorators/         # @Roles, @CurrentUser, @CurrentTenant
│   │   ├── filters/            # GlobalExceptionFilter with RFC 7807 responses
│   │   ├── guards/             # JwtAuthGuard, RolesGuard, SuperAdminGuard
│   │   └── infrastructure/     # PrismaService (AST middleware) & RedisService
│   └── scripts/
│       └── verify-architecture.js # AST linter enforcing DDD layer boundaries in CI/CD
└── docker-compose.yml          # PostgreSQL 16 (btree_gist), Redis 7, MinIO S3
```

---

## 🛡️ Key Enterprise Safeguards

### 1. Dual-Layer Multi-Tenant Defense-in-Depth (Native PostgreSQL RLS + Prisma AST Guard)
* **Layer 1 - Database Engine Kernel (Native PostgreSQL RLS):** 
  * All tenant-scoped relational tables (`customers`, `vehicles`, `appointments`, `work_orders`, `invoices`, `products`, etc.) have Row-Level Security enabled and forced (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;`).
  * Enforced via PostgreSQL `tenant_isolation_policy` checking `current_tenant_id()` and `rls_bypassed()` session state.
  * Connection pooler (PgBouncer) transaction-mode compatible via `SET LOCAL app.current_tenant_id = '...'` inside transactions (automatically resets upon commit/rollback, zero connection pool leakage).
  * Dedicated application role `worksauto_app` configured with `NOBYPASSRLS NOSUPERUSER`.
  * Even if a developer executes a raw SQL query (`$executeRaw` / `$queryRaw`) without a `WHERE tenant_id` clause, the PostgreSQL storage engine physically suppresses or rejects out-of-tenant data.
* **Layer 2 - Application Layer (Prisma Client Extension):**
  * Prisma Client `$extends` middleware automatically injects `tenantId` from request context (`AsyncLocalStorage` via `ClsService`) into every Prisma ORM query (`findMany`, `create`, `update`, `delete`, `count`, etc.).
  * Prevents accidental cross-tenant mutation attempts before queries even reach the network socket.
* **Compound Unique Constraints:**
  * High-frequency models enforce `@@unique([tenantId, ...])` compound unique keys, guaranteeing uniqueness per tenant.

### 2. Zero Collision Appointment Engine (PostgreSQL EXCLUDE USING gist)
* Overlapping bookings are prevented directly at the PostgreSQL database engine level using the `btree_gist` extension and `tstzrange` exclusion constraints:
  1. `no_overlapping_mechanic`: An assigned mechanic cannot work on multiple vehicles simultaneously.
  2. `no_overlapping_lift`: A physical garage lift bay cannot host more than one vehicle at any given timestamp.
* Because the constraints are enforced by the database kernel itself (`EXCLUDE USING gist`), concurrent booking race conditions (TOCTOU) are physically blocked across all code paths, including parallel requests and rescheduling.

### 3. Warehouse 2D Shelf Matrix & Cell Localization
* Automatic hierarchical cell code generation (`{SHELF}-K{ROW}-G{COL}`, e.g., `RAF-A01-K1-G1`).
* Real-time cell occupancy tracking, capacity percentage calculation, and atomic part-to-cell assignment/unassignment.

### 4. KVKK & İYS Compliance Ledger with Digital Signature
* **SMS Verification Workflow:** Generates one-time 24-byte cryptographic tokens (`/c/kvkk?token=...`) with a 7-day expiration.
* **Tamper-Evident Ledger:** Captures timestamp, IP address, user-agent, and policy version upon customer consent.
* **Right to be Forgotten:** PII is securely redacted in `customers`, with audit trails preserved in an append-only cryptographic hash chain.

### 5. Atomic Stock Concurrency Control
* Eliminates race conditions in fast-paced workshops via atomic single-query decrement:
  ```sql
  UPDATE products 
  SET stock_quantity = stock_quantity - :qty 
  WHERE id = :id AND tenant_id = :tenantId AND stock_quantity >= :qty
  ```
* Rejects the dispatch immediately without locking the entire table if available stock is insufficient.

### 6. High Availability & Disaster Recovery
* **RPO ≤ 15 Minutes:** Continuous PostgreSQL write-ahead log (WAL) archiving via `pgBackRest`/`WAL-G`.
* **RTO ≤ 1 Hour:** Asynchronous streaming warm standby replica with operator-controlled fencing promotion.
* **Redis Dual Failure Policy:**
  * *Fail-Open:* Cache misses and rate-limiting allow traffic during transient Redis degradation.
  * *Fail-Closed:* Idempotency checks and financial settlements strictly fail closed to protect against double charges.

---

## 📊 Database Schema (Prisma)

Contains **27 production-grade relational models**:

| Category | Models |
| :--- | :--- |
| **Tenancy & IAM** | `Tenant`, `Branch`, `User`, `Role`, `RefreshToken` |
| **CRM & Fleet** | `Customer`, `Vehicle`, `CustomerConsent`, `ComplianceRedactionLog` |
| **Operations** | `Mechanic`, `Appointment`, `WorkOrder`, `WorkOrderItem`, `WorkOrderPhoto`, `WorkOrderNote` |
| **Warehouse & Shelves** | `Product`, `StockMovement`, `WarehouseShelf`, `ShelfCell` |
| **Finance & Accounting** | `Service`, `Invoice`, `Payment`, `CurrentAccount`, `CariMovement`, `DocumentSequence` |
| **Audit & Reliability** | `AuditLog`, `IdempotencyRecord`, `Notification` |

---

## ⚡ API Endpoints Matrix

All endpoints are documented via Swagger UI at `/api/docs`:

| Module | Method | Endpoint | Description | Guard / RBAC |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `POST` | `/api/v1/admin/auth/login` | Super Admin credentials authentication | Public |
| **Super Admin** | `GET` | `/api/v1/admin/tenants` | Manage tenants & license statuses | `SUPER_ADMIN` |
| **Super Admin** | `GET` | `/api/v1/admin/audit-logs` | Platform-wide security audit inspection | `SUPER_ADMIN` |
| **Auth** | `POST` | `/api/v1/auth/login` | Staff authentication & JWT issue | Public |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Silent Refresh Token Rotation | Public |
| **Customers** | `GET` | `/api/v1/customers` | Paginated customer list & search | Staff |
| **Customers** | `POST` | `/api/v1/customers/:id/consent/sms` | Send KVKK consent verification link | Staff |
| **Public Consent** | `GET` | `/api/v1/consent/verify/:token` | Validate public customer verification token | Public |
| **Public Consent** | `POST` | `/api/v1/consent/confirm/:token` | Digital signature & timestamp confirmation | Public |
| **Shelves** | `POST` | `/api/v1/inventory/shelves` | Create shelf with automatic grid cells | Staff |
| **Shelves** | `GET` | `/api/v1/inventory/shelves/:id/matrix` | Full 2D shelf matrix with product occupancy | Staff |
| **Appointments**| `POST` | `/api/v1/appointments` | Book appointment with dual-collision check | Staff |
| **Work Orders** | `POST` | `/api/v1/work-orders/:id/parts` | Attach part with atomic stock decrement | Staff |
| **Invoices** | `POST` | `/api/v1/invoices` | Generate invoice & lock work order | Staff |
| **Ledger** | `GET` | `/api/v1/current-accounts/:id/statement`| Full customer account statement (ekstre) | Staff |

---

## 🧪 Testing & Quality Gate

```bash
# Unit & Use Case Test Suite (42 test suites, 125 tests)
npm run test

# Clean Architecture Layer Boundary Verification Linter
node scripts/verify-architecture.js

# TypeScript Strict Static Type Analysis
npx tsc --noEmit

# Static Code Analysis
npm run lint
```

---

## 🛠️ Getting Started

### Prerequisites
* **Node.js**: `v20.x` or `v22.x`
* **Docker Desktop**: For PostgreSQL 16, Redis 7, and MinIO S3

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ridvan-byr/worksauto-api.git
cd worksauto-api
npm ci
```

### 2. Environment Variables Setup
```bash
cp .env.example .env
```

### 3. Start Infrastructure via Docker
```bash
docker compose up -d
```

### 4. Run Prisma Migrations & Generate Client
```bash
npx prisma db push
npx prisma generate
```

### 5. Launch the NestJS Development Server
```bash
npm run start:dev
```
* **API Server:** `http://localhost:4000/api/v1`
* **Swagger Documentation:** `http://localhost:4000/api/docs`

---

## 👤 Lead Developer & Architect

**Rıdvan Emre Bayar**  
* Lead Full-Stack Software Engineer & End-to-End System Architect  
* GitHub: [@ridvan-byr](https://github.com/ridvan-byr)

---

## 📄 License

Proprietary — All rights reserved. WorksAuto © 2026.
