import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ICustomerRepository, QuickLeadInput, CustomerStatsResult, BatchImportResult } from '../domain/customer.repository.interface';
import { CustomerEntity, CustomerTypeVo } from '../domain/customer.entity';
import { CustomerType } from '@prisma/client';

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): CustomerEntity {
    return new CustomerEntity({
      id: data.id,
      tenantId: data.tenantId,
      type: data.type as CustomerTypeVo,
      firstName: data.firstName,
      lastName: data.lastName,
      companyTitle: data.companyTitle ?? undefined,
      phone: data.phone,
      email: data.email ?? undefined,
      taxNumber: data.taxNumber ?? undefined,
      taxOffice: data.taxOffice ?? undefined,
      creditLimit: data.creditLimit ? Number(data.creditLimit) : 0,
      notes: data.notes ?? undefined,
      isLead: Boolean(data.isLead),
      isAnonymized: Boolean(data.isAnonymized),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      vehicles: data.vehicles,
      currentAccount: data.currentAccount,
      appointments: data.appointments,
      workOrders: data.workOrders,
      invoices: data.invoices,
    });
  }

  async findById(tenantId: string, id: string): Promise<CustomerEntity | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vehicles: { where: { deletedAt: null } },
        currentAccount: { include: { movements: { orderBy: { date: 'desc' }, take: 20 } } },
        workOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        invoices: { orderBy: { issueDate: 'desc' }, take: 10 },
      },
    });

    return customer ? this.mapToEntity(customer) : null;
  }

  async findByPhone(tenantId: string, phone: string): Promise<CustomerEntity | null> {
    const customer = await this.prisma.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
    });
    return customer ? this.mapToEntity(customer) : null;
  }

  async findAll(tenantId: string, search?: string): Promise<CustomerEntity[]> {
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

    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...searchCondition,
      },
      include: {
        vehicles: { where: { deletedAt: null } },
        currentAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return customers.map((c) => this.mapToEntity(c));
  }

  async create(customer: CustomerEntity): Promise<CustomerEntity> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId: customer.tenantId,
          type: customer.type === 'CORPORATE' ? CustomerType.CORPORATE : CustomerType.INDIVIDUAL,
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyTitle: customer.companyTitle,
          phone: customer.phone,
          email: customer.email,
          taxNumber: customer.taxNumber,
          taxOffice: customer.taxOffice,
          creditLimit: customer.creditLimit || 0,
          notes: customer.notes,
          isLead: customer.isLead ?? false,
        },
      });

      await tx.currentAccount.create({
        data: {
          tenantId: customer.tenantId,
          customerId: created.id,
          creditLimit: customer.creditLimit || 0,
        },
      });

      return this.mapToEntity(created);
    });
  }

  async save(customer: CustomerEntity): Promise<CustomerEntity> {
    const existing = await this.prisma.customer.findFirst({
      where: { id: customer.id, tenantId: customer.tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Müşteri bulunamadı veya bu işletmeye ait değil.');
    }

    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        type: customer.type === 'CORPORATE' ? CustomerType.CORPORATE : CustomerType.INDIVIDUAL,
        firstName: customer.firstName,
        lastName: customer.lastName,
        companyTitle: customer.companyTitle,
        phone: customer.phone,
        email: customer.email,
        taxNumber: customer.taxNumber,
        taxOffice: customer.taxOffice,
        creditLimit: customer.creditLimit,
        notes: customer.notes,
        isLead: customer.isLead,
        isAnonymized: customer.isAnonymized,
      },
    });

    return this.mapToEntity(updated);
  }

  async softDelete(tenantId: string, id: string): Promise<CustomerEntity> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Müşteri bulunamadı veya bu işletmeye ait değil.');
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.mapToEntity(updated);
  }

  async getCustomerStats(tenantId: string, id: string): Promise<CustomerStatsResult> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { currentAccount: true },
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

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
    const attendanceScore = evaluated > 0 ? Math.round((completed / evaluated) * 100) : 100;
    const noShowRate = evaluated > 0 ? Math.round((noShow / evaluated) * 100) : 0;

    let riskCategory = 'LOW';
    if (noShow >= 2 || attendanceScore < 70) {
      riskCategory = 'HIGH';
    } else if (attendanceScore < 90) {
      riskCategory = 'MEDIUM';
    }

    const balance = customer.currentAccount?.balance ? Number(customer.currentAccount.balance) : 0;
    const creditLimit = customer.creditLimit ? Number(customer.creditLimit) : 0;

    return {
      totalAppointments: total,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowCount: noShow,
      noShowRate: `${noShowRate}%`,
      attendanceScore,
      riskCategory,
      balance,
      totalDebits: 0,
      totalCredits: 0,
      creditLimit,
      limitExceeded: creditLimit > 0 && balance > creditLimit,
    };
  }

  async quickLead(tenantId: string, dto: QuickLeadInput): Promise<{ customer: any; vehicle: any }> {
    return this.prisma.$transaction(async (tx) => {
      const cleanPlate = dto.plate.toUpperCase().replace(/\s+/g, '');

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
        customer: this.mapToEntity(customer),
        vehicle,
      };
    });
  }

  async batchImport(tenantId: string, rows: any[], options?: { updateExisting?: boolean }): Promise<BatchImportResult> {
    let importedCustomersCount = 0;
    let existingCustomersCount = 0;
    let updatedCustomersCount = 0;
    let importedVehiclesCount = 0;
    let existingVehiclesCount = 0;
    let updatedVehiclesCount = 0;
    const errors: any[] = [];
    const updateExisting = Boolean(options?.updateExisting);

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
            if (updateExisting) {
              const customerUpdate: any = {};
              if (row.companyTitle && row.companyTitle.trim()) customerUpdate.companyTitle = row.companyTitle.trim();
              if (row.email && row.email.trim()) customerUpdate.email = row.email.trim();
              if (row.taxNumber && row.taxNumber.trim()) customerUpdate.taxNumber = row.taxNumber.trim();
              if (row.taxOffice && row.taxOffice.trim()) customerUpdate.taxOffice = row.taxOffice.trim();
              if (row.notes && row.notes.trim()) customerUpdate.notes = row.notes.trim();
              if (row.type) customerUpdate.type = row.type;
              if (cName && cName !== 'İsimsiz Müşteri' && (!customer.firstName || customer.firstName === 'İsimsiz Müşteri')) {
                customerUpdate.firstName = cName;
              }
              if (cSurname && !customer.lastName) {
                customerUpdate.lastName = cSurname;
              }

              if (Object.keys(customerUpdate).length > 0) {
                await tx.customer.update({
                  where: { id: customer.id },
                  data: customerUpdate,
                });
                updatedCustomersCount++;
              }
            }
          }

          const cleanPlate = row.plate ? row.plate.trim().toUpperCase().replace(/\s+/g, '') : '';
          if (cleanPlate && customer) {
            const vehicle = await tx.vehicle.findFirst({
              where: { tenantId, plate: cleanPlate, deletedAt: null },
            });

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

            if (!vehicle) {
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
              if (updateExisting) {
                const vehicleUpdate: any = {};
                const parsedKm = Number(row.currentKm);
                if (!isNaN(parsedKm) && parsedKm > 0) {
                  vehicleUpdate.currentKm = parsedKm;
                }
                if (row.brand && row.brand.trim() && row.brand.trim() !== 'Belirtilmedi') {
                  vehicleUpdate.brand = row.brand.trim();
                }
                if (row.model && row.model.trim() && row.model.trim() !== 'Model Belirtilmedi') {
                  vehicleUpdate.model = row.model.trim();
                }
                const parsedYear = Number(row.year);
                if (!isNaN(parsedYear) && parsedYear >= 1900 && parsedYear <= new Date().getFullYear() + 1) {
                  vehicleUpdate.year = parsedYear;
                }
                if (row.vin && row.vin.trim()) {
                  vehicleUpdate.vin = row.vin.trim();
                }
                if (row.fuelType && row.fuelType.trim()) {
                  vehicleUpdate.fuelType = fuelType;
                }
                if (row.transmission && row.transmission.trim()) {
                  vehicleUpdate.transmission = transmission;
                }
                if (customer && vehicle.customerId !== customer.id) {
                  vehicleUpdate.customerId = customer.id;
                }

                if (Object.keys(vehicleUpdate).length > 0) {
                  await tx.vehicle.update({
                    where: { id: vehicle.id },
                    data: vehicleUpdate,
                  });
                  updatedVehiclesCount++;
                }
              }
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
      updatedCustomersCount,
      importedVehiclesCount,
      existingVehiclesCount,
      updatedVehiclesCount,
      errors,
    };
  }

  async anonymizeCustomer(tenantId: string, id: string, authorizedByUserId: string, legalRef: string): Promise<CustomerEntity> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    return this.prisma.$transaction(async (tx) => {
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

      return this.mapToEntity(anonymized);
    });
  }
}
