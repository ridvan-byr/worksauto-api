import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { WorkOrderStatus, InvoiceStatus } from '@prisma/client';
import {
  GetFinancialReportQueryDto,
  ReportPeriod,
  FinancialReportResponse,
} from './dto/financial-report.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      inProgressWorkOrdersCount,
      queueWorkOrdersCount,
      todayAppointmentsCount,
      criticalStockRows,
      totalCustomersCount,
      totalVehiclesCount,
      unpaidInvoices,
      todayPayments,
      monthlyPayments,
      recentWorkOrders,
    ] = await Promise.all([
      // 1. Atölyede liftte / işlemde olan iş emirleri
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: WorkOrderStatus.IN_PROGRESS,
        },
      }),

      // 1b. Atölyede sırada bekleyen iş emirleri
      this.prisma.workOrder.count({
        where: {
          tenantId,
          status: WorkOrderStatus.QUEUE,
        },
      }),

      // 2. Bugünkü randevular
      this.prisma.appointment.count({
        where: {
          tenantId,
          slotDate: today,
        },
      }),

      // 3. Kritik stok seviyesinin altına düşen parçalar (stock_quantity <= min_stock_level)
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM products
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND stock_quantity <= min_stock_level
      `,

      // 4. Toplam aktif müşteri sayısı
      this.prisma.customer.count({
        where: {
          tenantId,
          deletedAt: null,
        },
      }),

      // 5. Toplam aktif araç sayısı
      this.prisma.vehicle.count({
        where: {
          tenantId,
          deletedAt: null,
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
          customer: {
            select: { firstName: true, lastName: true, phone: true },
          },
          vehicle: { select: { plate: true, brand: true, model: true } },
          assignedMechanic: {
            include: { user: { select: { name: true, surname: true } } },
          },
        },
      }),
    ]);

    // Açık fatura toplam alacağını hesapla
    let unpaidTotal = 0;
    for (const inv of unpaidInvoices) {
      const remaining = Number(inv.grandTotal) - Number(inv.paidAmount);
      if (remaining > 0) unpaidTotal += remaining;
    }

    const activeWorkOrdersCount = inProgressWorkOrdersCount + queueWorkOrdersCount;

    return {
      activeWorkOrdersCount,
      inProgressWorkOrdersCount,
      queueWorkOrdersCount,
      todayAppointmentsCount,
      criticalStockCount: Number(criticalStockRows[0]?.count || 0),
      totalCustomersCount,
      totalVehiclesCount,
      unpaidInvoicesCount: unpaidInvoices.length,
      unpaidTotal,
      todayRevenue: Number(todayPayments._sum.amount || 0),
      monthlyRevenue: Number(monthlyPayments._sum.amount || 0),
      recentWorkOrders,
      generatedAt: new Date().toISOString(),
    };
  }

  async getFinancialReport(
    tenantId: string,
    query: GetFinancialReportQueryDto,
  ): Promise<FinancialReportResponse> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    const period = query.period || ReportPeriod.THIS_MONTH;

    switch (period) {
      case ReportPeriod.TODAY: {
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        );
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      }
      case ReportPeriod.YESTERDAY: {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        startDate = new Date(
          y.getFullYear(),
          y.getMonth(),
          y.getDate(),
          0,
          0,
          0,
          0,
        );
        endDate = new Date(
          y.getFullYear(),
          y.getMonth(),
          y.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      }
      case ReportPeriod.THIS_WEEK: {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(d.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      }
      case ReportPeriod.LAST_MONTH: {
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
          0,
          0,
          0,
          0,
        );
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999,
        );
        break;
      }
      case ReportPeriod.CUSTOM: {
        startDate = query.startDate
          ? new Date(query.startDate)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = query.endDate
          ? new Date(query.endDate)
          : new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59,
              999,
            );
        break;
      }
      case ReportPeriod.THIS_MONTH:
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      }
    }

    // 1. Fetch completed work orders in date range
    const completedOrders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        status: WorkOrderStatus.COMPLETED,
        OR: [
          { completedAt: { gte: startDate, lte: endDate } },
          { completedAt: null, updatedAt: { gte: startDate, lte: endDate } },
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyTitle: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            year: true,
          },
        },
        items: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            grandTotal: true,
            paidAmount: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // 2. Pre-fetch product purchase prices for linked parts
    const linkedProductIds = Array.from(
      new Set(
        completedOrders
          .flatMap((o) =>
            o.items
              .filter((i) => i.itemType === 'PART' && i.itemId)
              .map((i) => i.itemId as string),
          )
          .filter(Boolean),
      ),
    );

    let productCostMap = new Map<string, number>();
    if (linkedProductIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { tenantId, id: { in: linkedProductIds } },
        select: { id: true, purchasePrice: true },
      });
      productCostMap = new Map(
        products.map((p) => [p.id, Number(p.purchasePrice)]),
      );
    }

    // 3. Process completed orders metrics
    let totalLabourRevenue = 0;
    let totalPartsRevenue = 0;
    let totalPartsCost = 0;
    let totalRevenue = 0;
    const uniqueVehicles = new Set<string>();

    const recentCompletedOrders = completedOrders.map((order) => {
      let orderLabour = 0;
      let orderParts = 0;
      let orderPartsCost = 0;

      for (const item of order.items) {
        const itemTotal = Number(item.totalPrice || 0);
        if (item.itemType === 'SERVICE') {
          orderLabour += itemTotal;
        } else {
          orderParts += itemTotal;
          const knownCost = item.itemId
            ? productCostMap.get(item.itemId)
            : undefined;
          if (knownCost !== undefined) {
            orderPartsCost += knownCost * item.quantity;
          } else {
            // Estimated default 25% margin when cost is not recorded in catalog
            orderPartsCost += itemTotal * 0.75;
          }
        }
      }

      const orderGrandTotal =
        Number(order.grandTotal) || orderLabour + orderParts;
      const estimatedProfit = orderLabour + (orderParts - orderPartsCost);
      const profitMargin =
        orderGrandTotal > 0
          ? Math.round((estimatedProfit / orderGrandTotal) * 100)
          : 0;

      totalLabourRevenue += orderLabour;
      totalPartsRevenue += orderParts;
      totalPartsCost += orderPartsCost;
      totalRevenue += orderGrandTotal;

      if (order.vehicle?.plate) {
        uniqueVehicles.add(order.vehicle.plate);
      }

      const cName = order.customer
        ? order.customer.companyTitle ||
          `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim()
        : 'Müşteri';

      return {
        id: order.id,
        workOrderNumber: order.workOrderNumber,
        completedAt: (order.completedAt || order.updatedAt).toISOString(),
        plate: order.vehicle?.plate || 'Plaka Yok',
        vehicle:
          `${order.vehicle?.brand || ''} ${order.vehicle?.model || ''}`.trim() ||
          'Araç',
        customerName: cName,
        labourTotal: Math.round(orderLabour),
        partsTotal: Math.round(orderParts),
        partsCost: Math.round(orderPartsCost),
        grandTotal: Math.round(orderGrandTotal),
        estimatedProfit: Math.round(estimatedProfit),
        profitMargin,
        invoiceStatus: order.invoice?.status,
      };
    });

    const netProfit = totalLabourRevenue + (totalPartsRevenue - totalPartsCost);
    const overallProfitMargin =
      totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // 4. Payments breakdown
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        paymentDate: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        paymentMethod: true,
        paymentDate: true,
      },
    });

    const paymentMethodMap: Record<string, { label: string; amount: number }> =
      {
        CASH: { label: 'Nakit Kasa', amount: 0 },
        POS: { label: 'Kredi Kartı / POS', amount: 0 },
        BANK_TRANSFER: { label: 'Havale / EFT', amount: 0 },
        ONLINE: { label: 'Online Tahsilat', amount: 0 },
      };

    let totalPaymentsAmount = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      totalPaymentsAmount += amt;
      const key = p.paymentMethod || 'CASH';
      if (paymentMethodMap[key]) {
        paymentMethodMap[key].amount += amt;
      } else {
        paymentMethodMap.CASH.amount += amt;
      }
    }

    const paymentBreakdown = Object.entries(paymentMethodMap).map(
      ([method, info]) => ({
        method,
        label: info.label,
        amount: Math.round(info.amount),
        percentage:
          totalPaymentsAmount > 0
            ? Math.round((info.amount / totalPaymentsAmount) * 100)
            : 0,
      }),
    );

    // 5. Unpaid invoices in range
    const periodInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        issueDate: { gte: startDate, lte: endDate },
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] },
      },
      select: { grandTotal: true, paidAmount: true },
    });

    let unpaidReceivables = 0;
    for (const inv of periodInvoices) {
      unpaidReceivables += Math.max(
        0,
        Number(inv.grandTotal) - Number(inv.paidAmount),
      );
    }

    // 6. Daily trend (group by YYYY-MM-DD)
    const dailyMap = new Map<
      string,
      {
        revenue: number;
        labour: number;
        parts: number;
        profit: number;
        orderCount: number;
      }
    >();
    for (const ord of recentCompletedOrders) {
      const dayStr = ord.completedAt.split('T')[0];
      const entry = dailyMap.get(dayStr) || {
        revenue: 0,
        labour: 0,
        parts: 0,
        profit: 0,
        orderCount: 0,
      };
      entry.revenue += ord.grandTotal;
      entry.labour += ord.labourTotal;
      entry.parts += ord.partsTotal;
      entry.profit += ord.estimatedProfit;
      entry.orderCount += 1;
      dailyMap.set(dayStr, entry);
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => {
        const [, m, d] = date.split('-');
        return {
          date,
          label: `${d}.${m}`,
          revenue: Math.round(data.revenue),
          labour: Math.round(data.labour),
          parts: Math.round(data.parts),
          profit: Math.round(data.profit),
          orderCount: data.orderCount,
        };
      });

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalLabourRevenue: Math.round(totalLabourRevenue),
        totalPartsRevenue: Math.round(totalPartsRevenue),
        totalPartsCost: Math.round(totalPartsCost),
        netProfit: Math.round(netProfit),
        profitMargin: overallProfitMargin,
        cashCollected: Math.round(totalPaymentsAmount),
        unpaidReceivables: Math.round(unpaidReceivables),
        completedWorkOrdersCount: completedOrders.length,
        averageOrderValue:
          completedOrders.length > 0
            ? Math.round(totalRevenue / completedOrders.length)
            : 0,
        totalVehiclesServiced: uniqueVehicles.size,
      },
      paymentBreakdown,
      dailyTrend,
      recentCompletedOrders,
    };
  }
}
