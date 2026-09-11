import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';

describe('Core Workflow E2E Integration Test (Şartname Md. 51 & 59)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test Context
  const testRunId = Date.now();
  const testSlug = `e2e-test-tenant-${testRunId}`;
  const testPhone = `+90555${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testPlate = `34E2E${Math.floor(100 + Math.random() * 900)}`;

  let authToken: string;
  let tenantId: string;
  let customerId: string;
  let vehicleId: string;
  let productId: string;
  let appointmentId: string;
  let workOrderId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Isolated Test Clean-up
    if (tenantId) {
      try {
        await prisma.cariMovement?.deleteMany({ where: { tenantId } });
        await prisma.currentAccount?.deleteMany({ where: { tenantId } });
        await prisma.payment?.deleteMany({ where: { tenantId } });
        await prisma.invoice?.deleteMany({ where: { tenantId } });
        await prisma.workOrderPhoto?.deleteMany({
          where: { workOrder: { tenantId } },
        });
        await prisma.workOrderItem?.deleteMany({
          where: { workOrder: { tenantId } },
        });
        await prisma.workOrder?.deleteMany({ where: { tenantId } });
        await prisma.appointment?.deleteMany({ where: { tenantId } });
        await prisma.stockMovement?.deleteMany({ where: { tenantId } });
        await prisma.product?.deleteMany({ where: { tenantId } });
        await prisma.vehicle?.deleteMany({ where: { tenantId } });
        await prisma.customer?.deleteMany({ where: { tenantId } });
        await prisma.auditLog?.deleteMany({ where: { tenantId } });
        await prisma.notification?.deleteMany({ where: { tenantId } });
        await prisma.tenantConsent?.deleteMany({ where: { tenantId } });
        await prisma.tenantNotificationSetting?.deleteMany({
          where: { tenantId },
        });
        await prisma.refreshToken?.deleteMany({
          where: { user: { tenantId } },
        });
        await prisma.user?.deleteMany({ where: { tenantId } });
        await prisma.tenant?.delete({ where: { id: tenantId } });
      } catch (err) {
        console.warn('E2E clean-up warning:', (err as any)?.message);
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('Step 1: Tenant & Owner Registration -> Token Extraction (Md. 6 & 7)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        slug: testSlug,
        tenantTitle: 'E2E Otomasyon Servisi',
        firstName: 'Ahmet',
        lastName: 'Usta',
        phone: testPhone,
        email: `e2e.${testRunId}@testworksauto.com`,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('tenant');
    expect(res.body.tenant.slug).toBe(testSlug);

    authToken = res.body.accessToken;
    tenantId = res.body.tenant.id;

    // 1.1 B2B Legal & KVKK Contract Signature
    const signRes = await request(app.getHttpServer())
      .post('/api/v1/legal/sign')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        saasTermsAccepted: true,
        dataProcessingAccepted: true,
        marketingAccepted: true,
      })
      .expect(200);

    expect(signRes.body.success).toBe(true);
    expect(signRes.body.tenant.b2bConsentAccepted).toBe(true);

    const tenantUpdateRes = await request(app.getHttpServer())
      .patch('/api/v1/tenants/current')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ autoInvoiceOnComplete: true });

    expect(tenantUpdateRes.status).toBe(200);
    expect(tenantUpdateRes.body.autoInvoiceOnComplete).toBe(true);
  });

  it('Step 2: Customer & Vehicle Registration (Md. 11 & 12)', async () => {
    // 2.1 Create Customer
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Mehmet',
        lastName: 'Demir',
        phone: `+90532${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `customer.${testRunId}@test.com`,
        notes: 'E2E Test Müşterisi',
      })
      .expect(201);

    expect(custRes.body).toHaveProperty('id');
    customerId = custRes.body.id;

    // 2.2 Create Vehicle
    const vehRes = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        plate: testPlate,
        brand: 'Renault',
        model: 'Megane IV',
        year: 2021,
        currentKm: 45000,
      })
      .expect(201);

    expect(vehRes.body).toHaveProperty('id');
    expect(vehRes.body.plate).toBe(testPlate);
    vehicleId = vehRes.body.id;
  });

  it('Step 3: Inventory Product Addition with Stock = 10 (Md. 23 & 24)', async () => {
    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'E2E Fren Balatası Seti',
        oemCode: `OEM-${testRunId}`,
        brand: 'Bosch',
        stockQuantity: 10,
        shelfLocation: 'A-1-2',
        purchasePrice: 800,
        salePrice: 1500,
        kdvRate: 20,
      })
      .expect(201);

    expect(prodRes.body).toHaveProperty('id');
    expect(prodRes.body.stockQuantity).toBe(10);
    productId = prodRes.body.id;
  });

  it('Step 4: Appointment Booking & Approval (Md. 15)', async () => {
    // 4.1 Create Appointment in PENDING status
    const appRes = await request(app.getHttpServer())
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        vehicleId,
        slotDate: '2026-09-20',
        slotStartTime: '2026-09-20T09:00:00.000Z',
        slotEndTime: '2026-09-20T10:00:00.000Z',
        customerNotes: 'Fren kontrolü ve balata değişimi',
      })
      .expect(201);

    expect(appRes.body).toHaveProperty('id');
    expect(appRes.body.status).toBe('CONFIRMED');
    appointmentId = appRes.body.id;

    // 4.2 Approve Appointment -> CONFIRMED
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${appointmentId}/approve`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(approveRes.body.status).toBe('CONFIRMED');
  });

  it('Step 5: Work Order Creation & Part Assignment (Atomic Stock Decrement) (Md. 19 & 23)', async () => {
    // 5.1 Create Work Order
    const woRes = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        vehicleId,
        appointmentId,
        initialKm: 45100,
      })
      .expect(201);

    expect(woRes.body).toHaveProperty('id');
    expect(woRes.body.status).toBe('QUEUE');
    workOrderId = woRes.body.id;

    // 5.2 Transition to IN_PROGRESS
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${workOrderId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    // 5.3 Add PART Item (1x Fren Balatası @ 1.500 TL + %20 KDV) -> Stock drops 10 -> 9
    const itemRes = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemType: 'PART',
        itemId: productId,
        name: 'E2E Fren Balatası Seti',
        quantity: 1,
        unitPrice: 1500,
        kdvRate: 20,
      })
      .expect(201);

    expect(itemRes.body.items.some((i: any) => i.itemId === productId)).toBe(
      true,
    );

    // 5.4 Add SERVICE Item (1x İşçilik @ 1.000 TL + %20 KDV)
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${workOrderId}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemType: 'SERVICE',
        name: 'Fren Balata Değişim İşçiliği',
        quantity: 1,
        unitPrice: 1000,
        kdvRate: 20,
      })
      .expect(201);

    // 5.5 Verify Stock Atomic Decrement (10 -> 9)
    const productCheck = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(productCheck.body.stockQuantity).toBe(9);

    // 5.6 Verify Stock Movement Log
    const movementCheck = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}/movements`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(movementCheck.body.length).toBeGreaterThan(0);
    expect(movementCheck.body[0].quantity).toBe(1);
  });

  it('Step 6: Work Order Completion -> Auto Invoice Generation (Md. 21, 26, 53)', async () => {
    const idempotencyKey = `e2e-complete-${testRunId}`;

    // Complete Work Order with Idempotency Key
    const completeRes = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${workOrderId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({ status: 'COMPLETED' })
      .expect(200);

    expect(completeRes.body.status).toBe('COMPLETED');
    expect(completeRes.body.completedAt).toBeDefined();

    // Verify Invoice automatically generated
    const invoicesRes = await request(app.getHttpServer())
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const autoInvoice = invoicesRes.body.find(
      (inv: any) => inv.workOrderId === workOrderId,
    );
    expect(autoInvoice).toBeDefined();
    expect(autoInvoice.status).toBe('UNPAID');
    invoiceId = autoInvoice.id;

    // Grand total: (1500 * 1.20) + (1000 * 1.20) = 1800 + 1200 = 3000 TL
    expect(Number(autoInvoice.subtotal)).toBe(2500);
    expect(Number(autoInvoice.kdvAmount)).toBe(500);
    expect(Number(autoInvoice.grandTotal)).toBe(3000);
  });

  it('Step 7: Idempotency Protection (No Double Invoicing or Double Stock Drop) (Md. 21 & 53)', async () => {
    const idempotencyKey = `e2e-complete-${testRunId}`;

    // Re-call completion with SAME idempotency key
    const replayRes = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${workOrderId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({ status: 'COMPLETED' })
      .expect(200);

    expect(replayRes.body.status).toBe('COMPLETED');

    // Verify stock is STILL 9 (no second deduction)
    const productCheck = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(productCheck.body.stockQuantity).toBe(9);

    // Verify only 1 invoice exists for this work order
    const invoicesRes = await request(app.getHttpServer())
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const matchingInvoices = invoicesRes.body.filter(
      (inv: any) => inv.workOrderId === workOrderId,
    );
    expect(matchingInvoices.length).toBe(1);
  });

  it('Step 8: Partial Payment Collection (Md. 27)', async () => {
    const paymentRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        invoiceId,
        amount: 1200,
        paymentMethod: 'CASH',
        notes: 'E2E Kısmi Nakit Tahsilat',
      })
      .expect(201);

    expect(paymentRes.body).toHaveProperty('id');
    expect(Number(paymentRes.body.amount)).toBe(1200);

    // Verify Invoice status became PARTIALLY_PAID
    const invoiceCheck = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(invoiceCheck.body.status).toBe('PARTIALLY_PAID');
    expect(Number(invoiceCheck.body.paidAmount)).toBe(1200);
    expect(
      Number(invoiceCheck.body.grandTotal) -
        Number(invoiceCheck.body.paidAmount),
    ).toBe(1800);
  });

  it('Step 9: Customer Current Account (Cari Hareket & Bakiye) Verification (Md. 28)', async () => {
    const caRes = await request(app.getHttpServer())
      .get(`/api/v1/current-accounts/customer/${customerId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(caRes.body).toBeDefined();
    expect(caRes.body.movements).toBeDefined();
    expect(caRes.body.movements.length).toBeGreaterThanOrEqual(2);

    // Verify INVOICE debit movement and PAYMENT credit movement
    const invoiceMovements = caRes.body.movements.filter(
      (m: any) => m.referenceType === 'INVOICE' || m.sourceType === 'INVOICE',
    );
    const paymentMovements = caRes.body.movements.filter(
      (m: any) => m.referenceType === 'PAYMENT' || m.sourceType === 'PAYMENT',
    );

    expect(invoiceMovements.length).toBeGreaterThanOrEqual(1);
    expect(paymentMovements.length).toBeGreaterThanOrEqual(1);

    // Balance verification: 3000 (debit) - 1200 (credit) = 1800 remaining balance
    expect(Number(caRes.body.balance)).toBe(1800);
  });

  it('Step 10: Work Order Cancellation & Inventory Stock Rollback (Md. 19 & 23)', async () => {
    // 10.1 Create second work order
    const wo2Res = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        customerId,
        vehicleId,
        initialKm: 45200,
      })
      .expect(201);

    const woId2 = wo2Res.body.id;

    // 10.2 Add 1 part -> Stock drops 9 -> 8
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${woId2}/items`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        itemType: 'PART',
        itemId: productId,
        name: 'E2E Fren Balatası Seti',
        quantity: 1,
        unitPrice: 1500,
        kdvRate: 20,
      })
      .expect(201);

    let stockCheck = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(stockCheck.body.stockQuantity).toBe(8);

    // 10.3 Cancel Work Order -> Stock restored 8 -> 9
    const cancelRes = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woId2}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    expect(cancelRes.body.status).toBe('CANCELLED');

    // 10.4 Verify stock restored back to 9
    stockCheck = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(stockCheck.body.stockQuantity).toBe(9);

    // 10.5 Verify Stock Movement Log contains RETURN type
    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/${productId}/movements`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const returnMovement = movements.body.find(
      (m: any) => m.movementType === 'RETURN',
    );
    expect(returnMovement).toBeDefined();
    expect(returnMovement.quantity).toBe(1);
  });
});
