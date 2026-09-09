import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum ReportPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom',
}

export class GetFinancialReportQueryDto {
  @ApiPropertyOptional({ enum: ReportPeriod, default: ReportPeriod.THIS_MONTH })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export interface FinancialReportSummary {
  totalRevenue: number;
  totalLabourRevenue: number;
  totalPartsRevenue: number;
  totalPartsCost: number;
  netProfit: number;
  profitMargin: number;
  cashCollected: number;
  unpaidReceivables: number;
  completedWorkOrdersCount: number;
  averageOrderValue: number;
  totalVehiclesServiced: number;
}

export interface PaymentBreakdownItem {
  method: string;
  label: string;
  amount: number;
  percentage: number;
}

export interface DailyTrendItem {
  date: string;
  label: string;
  revenue: number;
  labour: number;
  parts: number;
  profit: number;
  orderCount: number;
}

export interface WorkOrderReportRow {
  id: string;
  workOrderNumber: string;
  completedAt: string;
  plate: string;
  vehicle: string;
  customerName: string;
  labourTotal: number;
  partsTotal: number;
  partsCost: number;
  grandTotal: number;
  estimatedProfit: number;
  profitMargin: number;
  invoiceStatus?: string;
}

export interface FinancialReportResponse {
  period: string;
  startDate: string;
  endDate: string;
  summary: FinancialReportSummary;
  paymentBreakdown: PaymentBreakdownItem[];
  dailyTrend: DailyTrendItem[];
  recentCompletedOrders: WorkOrderReportRow[];
}
