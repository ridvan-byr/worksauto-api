import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CustomerType } from '@prisma/client';

export interface CreateCustomerDto {
  type?: CustomerType;
  firstName: string;
  lastName: string;
  companyTitle?: string;
  phone: string;
  email?: string;
  taxNumber?: string;
  taxOffice?: string;
  creditLimit?: number;
  notes?: string;
  isLead?: boolean;
}

export interface QuickLeadDto {
  firstName: string;
  lastName?: string;
  phone: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
}

export interface BatchImportRowDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  companyTitle?: string;
  type?: CustomerType;
  taxNumber?: string;
  taxOffice?: string;
  notes?: string;
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  currentKm?: number;
  vin?: string;
  fuelType?: string;
  transmission?: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string) {
    let searchCondition: any = undefined;

    if (search && search.trim()) {
      const q = search.trim();
      const cleanQ = q.replace(/\s+/g, '');
      const parts = q.split(/\s+/).filter(Boolean);

      const orList: any[] = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { companyTitle: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { phone: { contains: cleanQ } },
        { email: { contains: q, mode: 'insensitive' } },
        { taxNumber: { contains: q } },
        {
          vehicles: {
            some: {
              deletedAt: null,
              OR: [
                { plate: { contains: q, mode: 'insensitive' } },
                { plate: { contains: cleanQ, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];

      if (parts.length >= 2) {
        const firstPart = parts[0];
        const restPart = parts.slice(1).join(' ');
        orList.push({
          AND: [
            { firstName: { contains: firstPart, mode: 'insensitive' } },
            { lastName: { contains: restPart, mode: 'insensitive' } },
          ],
        });
      }

      searchCondition = { OR: orList };
    }

    return this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(searchCondition || {}),
      },
      include: {
        vehicles: { where: { deletedAt: null } },
        currentAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vehicles: { where: { deletedAt: null } },
        currentAccount: { include: { movements: { orderBy: { date: 'desc' }, take: 20 } } },
        workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        invoices: { orderBy: { issueDate: 'desc' }, take: 10 },
      },
    });

    if (!customer) throw new NotFoundException('Müşteri bulunamadı.');
    return customer;
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          tenantId,
          type: dto.type || CustomerType.INDIVIDUAL,
          firstName: dto.firstName,
          lastName: dto.lastName,
          companyTitle: dto.companyTitle,
          phone: dto.phone,
          email: dto.email,
          taxNumber: dto.taxNumber,
          taxOffice: dto.taxOffice,
          creditLimit: dto.creditLimit || 0,
          notes: dto.notes,
          isLead: dto.isLead ?? false,
        },
      });

      // Automatically initialize Current Account
      await tx.currentAccount.create({
        data: {
          tenantId,
          customerId: customer.id,
          creditLimit: dto.creditLimit || 0,
        },
      });

      return customer;
    });
  }

  async quickLead(tenantId: string, dto: QuickLeadDto) {
    return this.prisma.$transaction(async (tx) => {
      const cleanPlate = dto.plate.toUpperCase().replace(/\s+/g, '');

      // 1. Create or find customer by phone
      let customer = await tx.customer.findFirst({
        where: { tenantId, phone: dto.phone, deletedAt: null },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId,
            type: CustomerType.INDIVIDUAL,
            firstName: dto.firstName,
            lastName: dto.lastName || '',
            phone: dto.phone,
            isLead: true,
          },
        });

        await tx.currentAccount.create({
          data: {
            tenantId,
            customerId: customer.id,
            creditLimit: 0,
          },
        });
      }

      // 2. Check or create vehicle for this customer
      let vehicle = await tx.vehicle.findFirst({
        where: { tenantId, plate: cleanPlate, deletedAt: null },
      });

      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            tenantId,
            customerId: customer.id,
            plate: cleanPlate,
            brand: dto.brand || 'Belirtilmedi',
            model: dto.model || 'Model Belirtilmedi',
            year: dto.year || new Date().getFullYear(),
          },
        });
      }

      return {
        customer,
        vehicle,
      };
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateCustomerDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: dto,
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * KVKK Right to be Forgotten (Cascading PII Anonymization)
   * Redacts customer PII while preserving legal financial records (VUK 10 years).
   */
  async anonymizeCustomer(tenantId: string, id: string, authorizedByUserId: string, legalRef: string) {
    const customer = await this.findOne(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      // 1. Redact Customer entity
      const anonymized = await tx.customer.update({
        where: { id },
        data: {
          firstName: 'ANONİM',
          lastName: `MÜŞTERİ_${customer.id.substring(0, 8)}`,
          companyTitle: null,
          phone: '0000000000',
          email: `anonymized_${customer.id.substring(0, 8)}@worksauto.local`,
          taxNumber: null,
          taxOffice: null,
          notes: '[KVKK Kapsamında Kişisel Veriler Anonimleştirildi]',
          isAnonymized: true,
          deletedAt: new Date(),
        },
      });

      // 2. Redact Audit Logs containing PII for this customer
      const affectedLogs = await tx.auditLog.findMany({
        where: { tenantId, entityName: 'Customer', entityId: id },
        select: { id: true },
      });

      await tx.auditLog.updateMany({
        where: { tenantId, entityName: 'Customer', entityId: id },
        data: {
          changesBefore: { firstName: '[MASKED_BY_KVKK]', lastName: '[MASKED_BY_KVKK]', phone: '[MASKED_BY_KVKK]' },
          changesAfter: { firstName: '[MASKED_BY_KVKK]', lastName: '[MASKED_BY_KVKK]', phone: '[MASKED_BY_KVKK]' },
        },
      });

      // 3. Record in append-only ComplianceRedactionLog with Hash Chaining
      const lastRedaction = await tx.complianceRedactionLog.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      const previousHash = lastRedaction ? lastRedaction.currentHash : 'GENESIS_HASH_WORKSAUTO_KVKK_2026';
      const currentHash = Buffer.from(`${previousHash}-${id}-${authorizedByUserId}-${new Date().toISOString()}`).toString('base64');

      await tx.complianceRedactionLog.create({
        data: {
          redactedCustomerId: id,
          authorizedByUserId,
          legalRequestRef: legalRef,
          affectedAuditLogIds: affectedLogs.map((l) => l.id),
          previousHash,
          currentHash,
        },
      });

      return anonymized;
    });
  }

  async getCustomerStats(tenantId: string, id: string) {
    const customer = await this.findOne(tenantId, id);

    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId, customerId: id },
      select: { status: true },
    });

    const total = appointments.length;
    const completed = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const active = appointments.filter((a) => ['PENDING', 'CONFIRMED', 'IN_SERVICE'].includes(a.status)).length;

    const evaluated = total - active;
    const reliabilityRate = evaluated > 0 ? Math.round((completed / evaluated) * 100) : 100;
    const noShowRate = evaluated > 0 ? Math.round((noShow / evaluated) * 100) : 0;

    let reliabilityBadge = 'GÜVENİLİR (YÜKSEK)';
    if (noShow >= 2 || reliabilityRate < 70) {
      reliabilityBadge = 'RİSKLİ (NO-SHOW SIK)';
    } else if (reliabilityRate < 90) {
      reliabilityBadge = 'ORTA';
    }

    return {
      customerId: id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      totalAppointments: total,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      activeAppointments: active,
      reliabilityRate: `${reliabilityRate}%`,
      noShowRate: `${noShowRate}%`,
      reliabilityBadge,
      creditLimit: customer.creditLimit,
      balance: customer.currentAccount?.balance ?? 0,
    };
  }

  async batchImport(tenantId: string, rows: BatchImportRowDto[]) {
    let importedCustomersCount = 0;
    let existingCustomersCount = 0;
    let importedVehiclesCount = 0;
    let existingVehiclesCount = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        await this.prisma.$transaction(async (tx) => {
          let customer: any = null;
          const rawPhone = (row.phone || '').trim();
          const digitsOnly = rawPhone.replace(/\D/g, '');
          let standardPhone = digitsOnly;
          if (standardPhone.startsWith('90') && standardPhone.length === 12) {
            standardPhone = standardPhone.slice(2);
          }
          if (standardPhone.length === 10 && standardPhone.startsWith('5')) {
            standardPhone = '0' + standardPhone;
          }

          if (standardPhone) {
            const phoneCandidates = [
              standardPhone,
              rawPhone,
              standardPhone.startsWith('0') ? standardPhone.slice(1) : '0' + standardPhone,
              standardPhone.startsWith('0') ? '+9' + standardPhone : '+90' + standardPhone,
            ].filter(Boolean);

            customer = await tx.customer.findFirst({
              where: {
                tenantId,
                phone: { in: phoneCandidates },
                deletedAt: null,
              },
            });
          }

          const cName = (row.firstName || '').trim() || (row.companyTitle || '').trim() || 'İsimsiz Müşteri';
          const cSurname = (row.lastName || '').trim();

          if (!customer) {
            customer = await tx.customer.create({
              data: {
                tenantId,
                type: row.type || (row.companyTitle ? CustomerType.CORPORATE : CustomerType.INDIVIDUAL),
                firstName: cName,
                lastName: cSurname,
                companyTitle: row.companyTitle || undefined,
                phone: standardPhone || rawPhone || '05000000000',
                email: row.email || undefined,
                taxNumber: row.taxNumber || undefined,
                taxOffice: row.taxOffice || undefined,
                notes: row.notes || undefined,
              },
            });

            await tx.currentAccount.create({
              data: {
                tenantId,
                customerId: customer.id,
                creditLimit: 0,
              },
            });

            importedCustomersCount++;
          } else {
            existingCustomersCount++;
          }

          // Handle Vehicle if plate is provided
          const cleanPlate = row.plate ? row.plate.trim().toUpperCase().replace(/\s+/g, '') : '';
          if (cleanPlate && customer) {
            const vehicle = await tx.vehicle.findFirst({
              where: { tenantId, plate: cleanPlate, deletedAt: null },
            });

            if (!vehicle) {
              let fuelType: any = 'DIESEL';
              const ft = (row.fuelType || '').toUpperCase();
              if (ft.includes('BENZ')) fuelType = 'GASOLINE';
              else if (ft.includes('LPG')) fuelType = 'LPG';
              else if (ft.includes('HİB') || ft.includes('HIB')) fuelType = 'HYBRID';
              else if (ft.includes('ELEK')) fuelType = 'ELECTRIC';

              let transmission: any = 'MANUAL';
              const tr = (row.transmission || '').toUpperCase();
              if (tr.includes('OTO')) transmission = 'AUTOMATIC';
              else if (tr.includes('YARI')) transmission = 'SEMI_AUTOMATIC';

              await tx.vehicle.create({
                data: {
                  tenantId,
                  customerId: customer.id,
                  plate: cleanPlate,
                  brand: (row.brand || '').trim() || 'Belirtilmedi',
                  model: (row.model || '').trim() || 'Model Belirtilmedi',
                  year: Number(row.year) || new Date().getFullYear(),
                  currentKm: Number(row.currentKm) || 0,
                  vin: (row.vin || '').trim() || undefined,
                  fuelType,
                  transmission,
                },
              });

              importedVehiclesCount++;
            } else {
              existingVehiclesCount++;
            }
          }
        });
      } catch (err: any) {
        errors.push({ row: rowNum, reason: err.message || 'Kayıt işlenemedi' });
      }
    }

    return {
      totalRows: rows.length,
      importedCustomersCount,
      existingCustomersCount,
      importedVehiclesCount,
      existingVehiclesCount,
      errors,
    };
  }
}
