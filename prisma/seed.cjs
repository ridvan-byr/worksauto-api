const { PrismaClient, UserRole, CustomerType, WorkOrderStatus, ProductCategory, WorkOrderItemType, FuelType } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // 0. Create Super Admin User (Platform Yönetim Merkezi)
  const passwordHash = await bcrypt.hash('WorksAuto2026!*', 10);
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+905000000000' },
    update: {
      email: 'admin@worksauto.com',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      phone: '+905000000000',
      email: 'admin@worksauto.com',
      passwordHash,
      name: 'Platform',
      surname: 'Yöneticisi',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`👑 Super Admin created: ${superAdmin.email} (${superAdmin.role})`);

  // 1. Create Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'bayar-oto' },
    update: {},
    create: {
      slug: 'bayar-oto',
      title: 'Bayar Oto Servis & Ekspertiz',
      legalName: 'Bayar Otomotiv Sanayi ve Ticaret Ltd. Şti.',
      taxNumber: '1234567890',
      taxOffice: 'İkitelli',
      phone: '+90 212 555 0123',
      email: 'info@bayaroto.com',
      address: 'İkitelli OSB, Dolapdere Sanayi Sitesi 12. Ada No:45',
      city: 'İstanbul',
      district: 'Başakşehir',
      isActive: true,
    },
  });
  console.log(`✅ Tenant created: ${tenant.title} (${tenant.id})`);

  // 2. Create Owner User (Rıdvan Bayar)
  const adminUser = await prisma.user.upsert({
    where: { phone: '+905551112233' },
    update: { role: UserRole.OWNER },
    create: {
      tenantId: tenant.id,
      phone: '+905551112233',
      email: 'ridvan@worksauto.com',
      name: 'Rıdvan',
      surname: 'Bayar',
      role: UserRole.OWNER,
      isActive: true,
    },
  });
  console.log(`✅ Owner user created: ${adminUser.name} ${adminUser.surname} (${adminUser.phone})`);

  // 3. Create Technician User (Mehmet Demir)
  const techUser = await prisma.user.upsert({
    where: { phone: '+905552223344' },
    update: { role: UserRole.TECHNICIAN },
    create: {
      tenantId: tenant.id,
      phone: '+905552223344',
      email: 'mehmet.usta@bayaroto.com',
      name: 'Mehmet',
      surname: 'Demir',
      role: UserRole.TECHNICIAN,
      isActive: true,
    },
  });

  // Mechanic profile
  const mechanicProfile = await prisma.mechanic.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: techUser.id,
      specialty: 'Motor, Mekanik & Fren Sistemleri',
      assignedLift: 'Lift 1',
      dailyCapacityHours: 8,
    },
  });
  console.log(`✅ Technician profile created: ${techUser.name} ${techUser.surname} (Mechanic ID: ${mechanicProfile.id})`);

  // 4. Seed Products (Yedek Parça Stoğu)
  const products = [
    {
      name: 'Castrol Edge 5W-30 Tam Sentetik Motor Yağı (4L)',
      oemCode: 'CAS-5W30-4L',
      barcode: '8690123456789',
      brand: 'Castrol',
      category: ProductCategory.LUBRICANTS,
      stockQuantity: 45,
      minStockLevel: 10,
      shelfLocation: 'Raf A-12',
      purchasePrice: 850.0,
      salePrice: 1450.0,
      kdvRate: 20.0,
    },
    {
      name: 'Ön Fren Balata Takımı (VW Golf 8 / Leon 4)',
      oemCode: '5WA698151A',
      barcode: '8690987654321',
      brand: 'Ferodo',
      category: ProductCategory.BRAKE,
      stockQuantity: 18,
      minStockLevel: 5,
      shelfLocation: 'Raf B-04',
      purchasePrice: 700.0,
      salePrice: 1250.0,
      kdvRate: 20.0,
    },
    {
      name: 'Mann-Filter Yağ Filtresi',
      oemCode: 'HU719/7X',
      barcode: '8690111222333',
      brand: 'Mann-Filter',
      category: ProductCategory.FILTERS,
      stockQuantity: 62,
      minStockLevel: 15,
      shelfLocation: 'Raf A-02',
      purchasePrice: 150.0,
      salePrice: 320.0,
      kdvRate: 20.0,
    },
    {
      name: 'Bosch Hava Filtresi',
      oemCode: 'F026400512',
      barcode: '8690444555666',
      brand: 'Bosch',
      category: ProductCategory.FILTERS,
      stockQuantity: 34,
      minStockLevel: 8,
      shelfLocation: 'Raf A-03',
      purchasePrice: 190.0,
      salePrice: 390.0,
      kdvRate: 20.0,
    },
  ];

  for (const prod of products) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, oemCode: prod.oemCode },
    });
    if (!existing) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          ...prod,
        },
      });
    }
  }
  console.log(`✅ Seeded ${products.length} spare parts into warehouse.`);

  // 5. Seed Customer & Vehicle
  let customer1 = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, phone: '+905551112233' },
  });
  if (!customer1) {
    customer1 = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Ahmet',
        lastName: 'Kaya',
        phone: '+905551112233',
        email: 'ahmet.kaya@example.com',
        type: CustomerType.INDIVIDUAL,
        creditLimit: 25000.0,
      },
    });
  }

  let vehicle1 = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id, plate: '34 ABC 789' },
  });
  if (!vehicle1) {
    vehicle1 = await prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        customerId: customer1.id,
        plate: '34 ABC 789',
        brand: 'Volkswagen',
        model: 'Golf 1.5 eTSI',
        year: 2022,
        vin: 'WVWZZZCDZNW012345',
        color: 'Titanium Gri',
        fuelType: FuelType.HYBRID,
        currentKm: 42500,
      },
    });
  }
  console.log(`✅ Customer & Vehicle created: ${customer1.firstName} ${customer1.lastName} -> ${vehicle1.plate}`);

  // 6. Seed Active Work Order
  const existingWo = await prisma.workOrder.findFirst({
    where: { tenantId: tenant.id, vehicleId: vehicle1.id },
  });

  if (!existingWo) {
    const workOrder = await prisma.workOrder.create({
      data: {
        tenantId: tenant.id,
        workOrderNumber: 'WO-2026-0001',
        customerId: customer1.id,
        vehicleId: vehicle1.id,
        assignedMechanicId: mechanicProfile.id,
        assignedLift: 'Lift 1',
        status: WorkOrderStatus.IN_PROGRESS,
        initialKm: 42500,
        fuelLevel: '%65',
        subtotal: 750.0,
        kdvAmount: 150.0,
        grandTotal: 900.0,
      },
    });

    // Add labor item
    await prisma.workOrderItem.create({
      data: {
        workOrderId: workOrder.id,
        itemType: WorkOrderItemType.SERVICE,
        name: 'Periyodik Yağ & Filtre Bakım İşçiliği',
        quantity: 1,
        unitPrice: 750.0,
        kdvRate: 20.0,
        totalPrice: 900.0,
      },
    });

    console.log(`✅ Active Work Order created: ${workOrder.workOrderNumber}`);
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
