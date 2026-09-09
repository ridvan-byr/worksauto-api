import { CustomerEntity } from './customer.entity';

export const CUSTOMER_REPOSITORY = 'ICustomerRepository';

export interface QuickLeadInput {
  firstName: string;
  lastName?: string;
  phone: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
}

export interface CustomerStatsResult {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  noShowRate: string;
  attendanceScore: number;
  riskCategory: string;
  balance: number;
  totalDebits: number;
  totalCredits: number;
  creditLimit: number;
  limitExceeded: boolean;
}

export interface BatchImportResult {
  totalRows: number;
  importedCustomersCount: number;
  existingCustomersCount: number;
  updatedCustomersCount?: number;
  importedVehiclesCount: number;
  existingVehiclesCount: number;
  updatedVehiclesCount?: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface ICustomerRepository {
  findById(tenantId: string, id: string): Promise<CustomerEntity | null>;
  findAll(tenantId: string, search?: string): Promise<CustomerEntity[]>;
  create(customer: CustomerEntity): Promise<CustomerEntity>;
  save(customer: CustomerEntity): Promise<CustomerEntity>;
  softDelete(tenantId: string, id: string): Promise<CustomerEntity>;
  findByPhone(tenantId: string, phone: string): Promise<CustomerEntity | null>;
  getCustomerStats(tenantId: string, id: string): Promise<CustomerStatsResult>;
  quickLead(tenantId: string, data: QuickLeadInput): Promise<{ customer: any; vehicle: any }>;
  batchImport(tenantId: string, items: any[], options?: { updateExisting?: boolean }): Promise<BatchImportResult>;
  anonymizeCustomer(tenantId: string, id: string, userId: string, legalRef: string): Promise<CustomerEntity>;
}
