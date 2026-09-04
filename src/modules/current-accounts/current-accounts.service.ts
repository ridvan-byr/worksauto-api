import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class CurrentAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.currentAccount.findMany({
      where: { tenantId },
      include: { customer: true },
      orderBy: { balance: 'desc' },
    });
  }

    async findByCustomerId(tenantId: string, customerId: string) {
    let ca = await this.prisma.currentAccount.findFirst({
      where: { tenantId, customerId },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
    });
    if (!ca) {
      const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } });
      if (!customer) throw new NotFoundException('Müşteri bulunamadı.');
      ca = await this.prisma.currentAccount.create({
        data: { tenantId, customerId },
        include: {
          customer: true,
          movements: { orderBy: { date: 'desc' } },
        },
      });
    }
    return ca;
  }
}
