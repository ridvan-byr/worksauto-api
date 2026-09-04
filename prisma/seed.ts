import { PrismaClient, WorkOrderStatus, CustomerType, WorkOrderPriority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting WorksAuto database seeding...');

  // 1. Create Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'bayar-oto' },
    update: {},
    create: {
      name: 'Bayar Oto Servis & Ekspertiz',
      slug: 'bayar-oto',
      subscriptionTier: 'ENTERPRISE',
      phone: '+90 212 555 0123',
      email: 'info@bayaroto.com',
      address: 'İkitelli OSB, Dolapdere Sanayi Sitesi 12. Ada No:45, Başakşehir / İstanbul',
      taxNumber: '1234567890',
      taxOffice: 'İkitelli',
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Tam Yetkili Servis Yöneticisi',
      permissions: ['*'],
    },
  });

  const technicianRole = await prisma.role.upsert({
    where: { name: 'TECHNICIAN' },
    update: {},
    create: {
      name: 'TECHNICIAN',
      description: 'Atölye Teknisyeni / Usta',
      permissions: ['work_orders:read', 'work_orders:update', 'inventory:read'],
    },
  });

  // 3. Create Admin User (Rıdvan Bayar)
  const passwordHash = await bcrypt.hash('Admin123!*', 10);
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'ridvan@worksauto.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'ridvan@worksauto.com',
      passwordHash,
      firstName: 'Rıdvan',
      lastName: 'Bayar',
      roleId: adminRole.id,
      phone: '+90 532 123 4567',
    },
  });
  console.log(`✅ Admin user created: ${adminUser.firstName} ${adminUser.lastName} (${adminUser.email})`);

  // 4. Create Technician User (Mehmet Demir Usta)
  const techUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'mehmet.usta@bayaroto.com',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'mehmet.usta@bayaroto.com',
      passwordHash,
      firstName: 'Mehmet',
      lastName: 'Demir',
      roleId: technicianRole.id,
      phone: '+90 533 987 6543',
    },
  });
  console.log(`✅ Technician user created: ${techUser.firstName} ${techUser.lastName}`);

  // 5. Seed Inventory Items (Yedek Parça Stoğu)
  const inventoryItems = [
    {
      sku: 'OIL-5W30-SYN',
      name: 'Castrol Edge 5W-30 Tam Sentetik Motor Yağı (4L)',
      barcode: '8690123456789',
      unit: 'ADET',
      stockQuantity: 45,
      minQuantity: 10,
      unitCost: 850.0,
      unitPrice: 1450.0,
      location: 'Raf A-12',
    },
    {
      sku: 'BRK-PAD-FR-VAG',
      name: 'Ön Fren Balata Takımı (VW/Audi/Seat/Skoda)',
      barcode: '8690987654321',
      unit: 'TAKIM',
      stockQuantity: 18,
      minQuantity: 5,
      unitCost: 700.0,
      unitPrice: 1250.0,
      location: 'Raf B-04',
    },
    {
      sku: 'FILT-OIL-UNI',
      name: 'Mann-Filter Yağ Filtresi',
      barcode: '8690111222333',
      unit: 'ADET',
      stockQuantity: 62,
      minQuantity: 15,
      unitCost: 150.0,
      unitPrice: 320.0,
      location: 'Raf A-02',
    },
    {
      sku: 'FILT-AIR-UNI',
      name: 'Bosch Hava Filtresi',
      barcode: '8690444555666',
      unit: 'ADET',
      stockQuantity: 34,
      minQuantity: 8,
      unitCost: 190.0,
      unitPrice: 390.0,
      location: 'Raf A-03',
    },
    {
      sku: 'SPK-PLG-IRID',
      name: 'NGK Lazer İridyum Buji (4 Adet Takım)',
      barcode: '8690777888999',
      unit: 'TAKIM',
      stockQuantity: 12,
      minQuantity: 4,
      unitCost: 950.0,
      unitPrice: 1750.0,
      location: 'Raf C-01',
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku: item.sku,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...item,
      },
    });
  }
  console.log(`✅ Seeded ${inventoryItems.length} inventory items.`);

  // 6. Seed Customers & Vehicles
  const customer1 = await prisma.customer.upsert({
    where: {
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '+90 555 111 2233',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      firstName: 'Ahmet',
      lastName: 'Kaya',
      phone: '+90 555 111 2233',
      email: 'ahmet.kaya@example.com',
      type: CustomerType.INDIVIDUAL,
      address: 'Ataşehir, İstanbul',
    },
  });

  const vehicle1 = await prisma.vehicle.upsert({
    where: {
      tenantId_plateNumber: {
        tenantId: tenant.id,
        plateNumber: '34 ABC 789',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      customerId: customer1.id,
      plateNumber: '34 ABC 789',
      brand: 'Volkswagen',
      model: 'Golf 1.5 eTSI',
      year: 2022,
      vin: 'WVWZZZCDZNW012345',
      color: 'Titanium Gri',
      fuelType: 'GASOLINE_HYBRID',
      currentKm: 42500,
    },
  });
  console.log(`✅ Customer & Vehicle created: ${customer1.firstName} ${customer1.lastName} -> ${vehicle1.plateNumber}`);

  // 7. Seed Active Work Order
  const existingWo = await prisma.workOrder.findFirst({
    where: { tenantId: tenant.id, vehicleId: vehicle1.id },
  });

  if (!existingWo) {
    const workOrder = await prisma.workOrder.create({
      data: {
        tenantId: tenant.id,
        orderNumber: 'WO-2026-0001',
        customerId: customer1.id,
        vehicleId: vehicle1.id,
        assignedMechanicId: techUser.id,
        assignedLift: 'Lift 1',
        status: WorkOrderStatus.IN_PROGRESS,
        priority: WorkOrderPriority.MEDIUM,
        fuelLevel: 65,
        estimatedTotal: 3410.0,
        customerComplaint: 'Periyodik 45.000 km bakımı, hafif fren sesi şikayeti.',
      },
    });

    // Add labor
    await prisma.workOrderLabor.create({
      data: {
        workOrderId: workOrder.id,
        description: 'Periyodik Yağ & Filtre Bakım İşçiliği',
        hours: 1.5,
        hourlyRate: 600.0,
        total: 900.0,
      },
    });

    console.log(`✅ Active Work Order created: ${workOrder.orderNumber}`);
  }

  console.log('🎉 WorksAuto database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
