import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { WorkOrderStatus, InvoiceStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      activeWorkOrdersCount,
      todayAppointmentsCount,
      criticalStockCount,
      unpaidInvoices,
      todayPayments,
      monthlyPayments,
      recentWorkOrders,
    ] = await Promise.all([
      // 1. Atölyedeki aktif iş emirleri
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: { in: [WorkOrderStatus.QUEUE, WorkOrderStatus.IN_PROGRESS] },
        },
      }),

      // 2. Bugünkü randevular
      this.prisma.appointment.count({
        where: {
          tenantId,
          slotDate: today,
        },
      }),

      // 3. Kritik stok seviyesinin altına düşen parçalar
      this.prisma.product.count({
        where: {
          tenantId,
          deletedAt: null,
          stockQuantity: { lte: 10 },
        },
      }),

      // 4. Açık / tahsilat bekleyen faturalar
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
        },
        select: { grandTotal: true, paidAmount: true },
      }),

      // 5. Bugünkü kasa tahsilatları
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: today },
        },
        _sum: { amount: true },
      }),

      // 6. Bu ayki toplam ciro
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // 7. Atölyedeki son 5 iş emri (Ana sayfa canlı takip tablosu)
      this.prisma.workOrder.findMany({
        where: {
          tenantId,
          status: { in: [WorkOrderStatus.QUEUE, WorkOrderStatus.IN_PROGRESS] },
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
          assignedMechanic: { include: { user: { select: { name: true, surname: true } } } },
        },
      }),
    ]);

    // Açık fatura toplam alacağını hesapla
    let unpaidTotal = 0;
    for (const inv of unpaidInvoices) {
      const remaining = Number(inv.grandTotal) - Number(inv.paidAmount);
      if (remaining > 0) unpaidTotal += remaining;
    }

    return {
      activeWorkOrdersCount,
      todayAppointmentsCount,
      criticalStockCount,
      unpaidInvoicesCount: unpaidInvoices.length,
      unpaidTotal,
      todayRevenue: Number(todayPayments._sum.amount || 0),
      monthlyRevenue: Number(monthlyPayments._sum.amount || 0),
      recentWorkOrders,
      generatedAt: new Date().toISOString(),
    };
  }
}
