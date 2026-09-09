import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ICurrentAccountRepository } from '../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../domain/current-account.entity';

@Injectable()
export class PrismaCurrentAccountRepository implements ICurrentAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(data: any): CurrentAccountEntity {
    return new CurrentAccountEntity({
      id: data.id,
      tenantId: data.tenantId,
      customerId: data.customerId,
      totalDebits: data.totalDebits ? Number(data.totalDebits) : 0,
      totalCredits: data.totalCredits ? Number(data.totalCredits) : 0,
      balance: data.balance ? Number(data.balance) : 0,
      creditLimit: data.creditLimit ? Number(data.creditLimit) : 0,
      isBlocked: Boolean(data.isBlocked),
      customer: data.customer,
      movements: (data.movements || []).map((m: any) => ({
        id: m.id,
        tenantId: m.tenantId,
        currentAccountId: m.currentAccountId,
        date: m.date,
        description: m.description,
        referenceType: m.referenceType,
        referenceNo: m.referenceNo ?? undefined,
        debit: Number(m.debit || 0),
        credit: Number(m.credit || 0),
        balanceAfter: Number(m.balanceAfter || 0),
      })),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  async findAll(tenantId: string): Promise<CurrentAccountEntity[]> {
    const records = await this.prisma.currentAccount.findMany({
      where: { tenantId },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
      orderBy: { balance: 'desc' },
    });

    return records.map((r) => this.mapToEntity(r));
  }

  async findByCustomerId(tenantId: string, customerId: string): Promise<CurrentAccountEntity | null> {
    const record = await this.prisma.currentAccount.findFirst({
      where: { tenantId, customerId },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async customerExists(tenantId: string, customerId: string): Promise<boolean> {
    const count = await this.prisma.customer.count({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    return count > 0;
  }

  async create(currentAccount: CurrentAccountEntity): Promise<CurrentAccountEntity> {
    const created = await this.prisma.currentAccount.create({
      data: {
        tenantId: currentAccount.tenantId,
        customerId: currentAccount.customerId,
        totalDebits: currentAccount.totalDebits,
        totalCredits: currentAccount.totalCredits,
        balance: currentAccount.balance,
        creditLimit: currentAccount.creditLimit,
        isBlocked: currentAccount.isBlocked,
      },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
    });

    return this.mapToEntity(created);
  }

  async save(currentAccount: CurrentAccountEntity): Promise<CurrentAccountEntity> {
    if (!currentAccount.id) {
      return this.create(currentAccount);
    }

    const updated = await this.prisma.currentAccount.update({
      where: { id: currentAccount.id },
      data: {
        totalDebits: currentAccount.totalDebits,
        totalCredits: currentAccount.totalCredits,
        balance: currentAccount.balance,
        creditLimit: currentAccount.creditLimit,
        isBlocked: currentAccount.isBlocked,
      },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
    });

    return this.mapToEntity(updated);
  }
}
