<div align="center">

  <img src="assets/brand/worksauto-logo-dark.png#gh-light-mode-only" alt="WorksAuto Logo" width="340" />
  <img src="assets/brand/worksauto-logo-white.png#gh-dark-mode-only" alt="WorksAuto Logo" width="340" />

  <p align="center">
    <strong>Enterprise-Grade Multi-Tenant Auto Service & Workshop Backend Core</strong>
  </p>

  <p align="center">
    <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-10.x-ea2845?style=for-the-badge&logo=nestjs" alt="NestJS" /></a>
    <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-16_RLS-336791?style=for-the-badge&logo=postgresql" alt="PostgreSQL" /></a>
    <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-6.x-2d3748?style=for-the-badge&logo=prisma" alt="Prisma" /></a>
    <a href="https://redis.io"><img src="https://img.shields.io/badge/Redis-7_BullMQ-dc382d?style=for-the-badge&logo=redis" alt="Redis" /></a>
    <a href="https://min.io"><img src="https://img.shields.io/badge/MinIO-S3_Storage-c72c48?style=for-the-badge&logo=minio" alt="MinIO" /></a>
    <a href="https://swagger.io"><img src="https://img.shields.io/badge/Swagger-OpenAPI_3.0-85ea2d?style=for-the-badge&logo=swagger" alt="Swagger" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" /></a>
  </p>

  <p align="center">
    <a href="#-about-the-project">About</a> •
    <a href="#-architecture--domain-modules">Architecture</a> •
    <a href="#-key-enterprise-safeguards">Safeguards</a> •
    <a href="#-database-schema-prisma">Database Schema</a> •
    <a href="#-api-endpoints-matrix">API Matrix</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-author">Author</a>
  </p>

</div>

---

## 🚀 About the Project

**WorksAuto API** is the mission-critical core backend engine for the WorksAuto multi-tenant automotive repair shop and dealership management SaaS platform.

Engineered with **Domain-Driven Design (DDD)** and strict **Row-Level Security (RLS)**, it provides financial accuracy, real-time garage bay synchronization, atomic stock decrements, and automated regulatory compliance (KVKK / GDPR / VUK).

---

## 🏛️ Architecture & Domain Modules

The application is structured into isolated Bounded Contexts under `src/modules/`:

```
worksauto-api/
├── prisma/
│   └── schema.prisma           # 22 Domain Models with multi-tenant indices & extensions
├── src/
│   ├── modules/
│   │   ├── auth/               # JWT, Refresh Token Rotation, Reuse Detection & Tenant Context
│   │   ├── customers/          # CRM + Cryptographic KVKK Anonymization Engine
│   │   ├── vehicles/           # Plate & VIN uniqueness validation, vehicle history
│   │   ├── appointments/       # Dual-collision prevention (Mechanic & Lift double-booking)
│   │   ├── inventory/          # Atomic conditional stock decrements & reorder tracking
│   │   ├── work-orders/        # Service orders, part usage, labor & status rollback engine
│   │   ├── invoices/           # VUK 10-year immutable invoicing & current account sync
│   │   ├── payments/           # Settlement processing & cashier daily closing registers
│   │   └── current-accounts/   # Customer ledger, running balances & PDF extract syncing
│   ├── shared/
│   │   ├── decorators/         # @Roles, @CurrentUser, @CurrentTenant
│   │   ├── filters/            # GlobalExceptionFilter with standard RFC 7807 responses
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   └── infrastructure/     # PrismaService (RLS runner) & RedisService (Fail-Open/Closed)
└── docker-compose.yml          # PostgreSQL 16 (btree_gist), Redis 7, MinIO S3
```

---

## 🛡️ Key Enterprise Safeguards

### 1. Multi-Tenant Row Level Security (RLS)
* Built upon PostgreSQL native Row-Level Security (`ENABLE ROW LEVEL SECURITY`).
* Every tenant transaction executes via `withTenantContext()` using `SET LOCAL app.current_tenant_id = :tenantId`.
* PgBouncer is configured in **transaction-mode**, guaranteeing that connection pooling multiplexing remains hyper-performant while `SET LOCAL` is automatically cleared at the end of each transaction boundary.

### 2. Zero Collision Appointment Engine
* Dual exclusion constraint logic preventing overlap:
  1. `no_overlapping_mechanic`: An assigned mechanic cannot work on multiple vehicles simultaneously.
  2. `no_overlapping_lift`: A physical garage lift bay cannot host more than one vehicle at any given timestamp.

### 3. Atomic Stock Concurrency Control
* Eliminates race conditions in fast-paced workshops via atomic single-query decrement:
  ```sql
  UPDATE inventory_items 
  SET stock_quantity = stock_quantity - :qty 
  WHERE id = :id AND tenant_id = :tenantId AND stock_quantity >= :qty
  ```
* If available stock is insufficient, the statement updates 0 rows and rejects the dispatch immediately without locking the table.

### 4. KVKK / GDPR Anonymization Engine with Cryptographic Hash-Chaining
* When a customer exercises their "Right to be Forgotten":
  * Personal Identifiable Information (PII) is securely masked in `customers` table.
  * Audit trails are recorded in an append-only `compliance_redaction_logs` table.
  * Each log record includes a `previous_hash` forming a **tamper-evident SHA-256 cryptographic chain**.
  * Database-level `REVOKE UPDATE, DELETE` guarantees that even compromised applications cannot alter the compliance chain.

### 5. High Availability & Disaster Recovery
* **RPO ≤ 15 Minutes:** Continuous PostgreSQL write-ahead log (WAL) archiving via `pgBackRest`/`WAL-G` streaming directly to geographically distinct object storage.
* **RTO ≤ 1 Hour:** Asynchronous streaming warm standby replica with operator-controlled STONITH split-brain fencing promotion.
* **Redis Dual Failure Policy:**
  * *Fail-Open:* Cache misses and rate-limiting allow traffic during transient Redis degradation to prevent customer disruption.
  * *Fail-Closed:* Idempotency checks and financial settlements strictly fail closed to protect against double charges.

---

## 📊 Database Schema (Prisma)

Contains 22 production-grade relational models:

| Category | Models |
| :--- | :--- |
| **Tenancy & IAM** | `Tenant`, `User`, `Role`, `RefreshToken` |
| **CRM & Fleet** | `Customer`, `Vehicle`, `ComplianceRedactionLog` |
| **Operations** | `Appointment`, `WorkOrder`, `WorkOrderPart`, `WorkOrderLabor`, `WorkOrderPhoto` |
| **Warehouse** | `InventoryItem`, `StockMovement` |
| **Finance & Accounting** | `Invoice`, `InvoiceItem`, `Payment`, `CurrentAccountTransaction`, `CashRegisterClosing` |
| **Audit & Governance** | `AuditLog` |

---

## ⚡ API Endpoints Matrix

All endpoints are documented via Swagger UI at `/api/docs`:

| Module | Method | Endpoint | Description | Guard / RBAC |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/login` | Staff authentication & JWT issue | Public |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Silent Refresh Token Rotation | Public |
| **Customers** | `GET` | `/api/v1/customers` | Paginated customer list | `ADMIN`, `ADVISOR` |
| **Customers** | `POST` | `/api/v1/customers/:id/anonymize`| KVKK Right to be Forgotten | `ADMIN` only |
| **Appointments**| `POST` | `/api/v1/appointments` | Book appointment with collision check | Staff |
| **Inventory** | `POST` | `/api/v1/inventory/items` | Create parts with barcode | Staff |
| **Work Orders** | `POST` | `/api/v1/work-orders/:id/parts` | Attach part with atomic decrement | Staff |
| **Invoices** | `POST` | `/api/v1/invoices` | Generate invoice & lock work order | Staff |
| **Payments** | `POST` | `/api/v1/payments` | Process payment & settle balance | Staff |
| **Ledger** | `GET` | `/api/v1/current-accounts/:id/statement` | Full statement (ekstre) | Staff |

---

## 🛠️ Getting Started

### Prerequisites
* **Node.js**: `v20.x` or higher
* **Docker Desktop**: For PostgreSQL 16, Redis 7, and MinIO S3

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ridvan-byr/worksauto-api.git
cd worksauto-api
npm install
```

### 2. Environment Variables Setup
Copy the example environment file and adjust credentials if needed:
```bash
cp .env.example .env
```

### 3. Start Infrastructure via Docker
```bash
docker compose up -d
```

### 4. Run Prisma Database Migrations
```bash
npx prisma migrate dev --name init
npx prisma db seed # (optional)
```

### 5. Launch the NestJS Development Server
```bash
npm run start:dev
```
* **API Server:** `http://localhost:4000/api/v1`
* **Swagger Documentation:** `http://localhost:4000/api/docs`

---

## 👤 Author

**Rıdvan Bayar**  
* Founder & Lead Architect, WorksAuto  
* GitHub: [@ridvan-byr](https://github.com/ridvan-byr)

---

## 📄 License

Proprietary — All rights reserved. WorksAuto © 2026.
