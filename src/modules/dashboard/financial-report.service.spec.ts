import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { WorkOrderStatus, WorkOrderItemType, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { ReportPeriod } from './dto/financial-report.dto';

describe('DashboardService - Financial Report', () => {
  let service: DashboardService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workOrder: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      invoice: {
        findMany: vi.fn(),
      },
      appointment: {
        count: vi.fn(),
      },
      customer: {
        count: vi.fn(),
      },
      vehicle: {
        count: vi.fn(),
      },
      $queryRaw: vi.fn(),
    };

    service = new DashboardService(mockPrisma as unknown as PrismaService);
  });

  it('should calculate revenue, labour, parts, cost and net profit correctly', async () => {
    const mockOrders = [
      {
        id: 'wo-1',
        workOrderNumber: 'WO-001',
        completedAt: new Date('2026-09-05T10:00:00Z'),
        updatedAt: new Date('2026-09-05T10:00:00Z'),
        grandTotal: 10000,
        customer: { firstName: 'Ahmet', lastName: 'Yılmaz', companyTitle: null, phone: '05321112233' },
        vehicle: { plate: '34ABC01', brand: 'BMW', model: '320i', year: 2021 },
        items: [
          { itemType: WorkOrderItemType.SERVICE, totalPrice: 3000, quantity: 1, unitPrice: 3000 },
          { itemType: WorkOrderItemType.PART, itemId: 'prod-1', totalPrice: 7000, quantity: 2, unitPrice: 3500 },
        ],
        invoice: { status: InvoiceStatus.PAID },
      },
    ];

    mockPrisma.workOrder.findMany.mockResolvedValue(mockOrders);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', purchasePrice: 2000 }, // 2 adet * 2000 = 4000 maliyet
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      { amount: 10000, paymentMethod: PaymentMethod.POS, paymentDate: new Date('2026-09-05T10:30:00Z') },
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await service.getFinancialReport('tenant-1', { period: ReportPeriod.THIS_MONTH });

    expect(result.summary.totalRevenue).toBe(10000);
    expect(result.summary.totalLabourRevenue).toBe(3000);
    expect(result.summary.totalPartsRevenue).toBe(7000);
    expect(result.summary.totalPartsCost).toBe(4000); // 2 * 2000
    // Net profit = 3000 (labour) + (7000 - 4000) (parts profit) = 6000
    expect(result.summary.netProfit).toBe(6000);
    expect(result.summary.profitMargin).toBe(60); // 6000 / 10000 = 60%
    expect(result.summary.cashCollected).toBe(10000);
    expect(result.summary.completedWorkOrdersCount).toBe(1);
    expect(result.paymentBreakdown.find((p) => p.method === 'POS')?.amount).toBe(10000);
    expect(result.dailyTrend.length).toBe(1);
    expect(result.dailyTrend[0].revenue).toBe(10000);
  });

  it('should estimate parts cost at 75% if part has no linked product card', async () => {
    const mockOrders = [
      {
        id: 'wo-2',
        workOrderNumber: 'WO-002',
        completedAt: new Date('2026-09-08T12:00:00Z'),
        updatedAt: new Date('2026-09-08T12:00:00Z'),
        grandTotal: 4000,
        customer: { firstName: 'Mehmet', lastName: 'Demir', companyTitle: null },
        vehicle: { plate: '06XYZ99', brand: 'Renault', model: 'Clio', year: 2019 },
        items: [
          { itemType: WorkOrderItemType.PART, itemId: null, totalPrice: 4000, quantity: 1, unitPrice: 4000 },
        ],
        invoice: null,
      },
    ];

    mockPrisma.workOrder.findMany.mockResolvedValue(mockOrders);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);

    const result = await service.getFinancialReport('tenant-1', { period: ReportPeriod.THIS_WEEK });

    expect(result.summary.totalPartsRevenue).toBe(4000);
    expect(result.summary.totalPartsCost).toBe(3000); // 4000 * 0.75
    expect(result.summary.netProfit).toBe(1000); // 4000 - 3000
    expect(result.summary.profitMargin).toBe(25);
  });
});
