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
    const ca = await this.prisma.currentAccount.findFirst({
      where: { tenantId, customerId },
      include: {
        customer: true,
        movements: { orderBy: { date: 'desc' } },
      },
    });
    if (!ca) throw new NotFoundException('Cari hesap bulunamadı.');
    return ca;
  }
}
