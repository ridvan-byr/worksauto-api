export type CustomerTypeVo = 'INDIVIDUAL' | 'CORPORATE';

export interface CustomerProps {
  id?: string;
  tenantId: string;
  type?: CustomerTypeVo;
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
  isAnonymized?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  vehicles?: any[];
  currentAccount?: any;
  appointments?: any[];
  workOrders?: any[];
  invoices?: any[];
}

export class CustomerEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public type: CustomerTypeVo;
  public firstName: string;
  public lastName: string;
  public companyTitle?: string;
  public phone: string;
  public email?: string;
  public taxNumber?: string;
  public taxOffice?: string;
  public creditLimit: number;
  public notes?: string;
  public isLead: boolean;
  public isAnonymized: boolean;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public vehicles?: any[];
  public currentAccount?: any;
  public appointments?: any[];
  public workOrders?: any[];
  public invoices?: any[];

  constructor(props: CustomerProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.type = props.type || 'INDIVIDUAL';
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.companyTitle = props.companyTitle;
    this.phone = props.phone;
    this.email = props.email;
    this.taxNumber = props.taxNumber;
    this.taxOffice = props.taxOffice;
    this.creditLimit = props.creditLimit ?? 0;
    this.notes = props.notes;
    this.isLead = props.isLead ?? false;
    this.isAnonymized = props.isAnonymized ?? false;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.vehicles = props.vehicles;
    this.currentAccount = props.currentAccount;
    this.appointments = props.appointments;
    this.workOrders = props.workOrders;
    this.invoices = props.invoices;
  }

  public isCorporate(): boolean {
    return this.type === 'CORPORATE';
  }

  public getDisplayName(): string {
    if (this.isCorporate() && this.companyTitle) {
      return this.companyTitle;
    }
    return `${this.firstName} ${this.lastName}`.trim() || 'Müşteri';
  }

  public updateCreditLimit(limit: number): void {
    if (limit < 0) {
      throw new Error('Kredi limiti negatif olamaz.');
    }
    this.creditLimit = limit;
  }

  public anonymize(legalRef: string): void {
    this.firstName = 'ANONİM';
    this.lastName = 'MÜŞTERİ';
    this.phone = '0000000000';
    this.email = undefined;
    this.companyTitle = undefined;
    this.taxNumber = undefined;
    this.taxOffice = undefined;
    this.isAnonymized = true;
    this.notes = `KVKK Unutulma Hakkı Talebi (Ref: ${legalRef})`;
  }
}
