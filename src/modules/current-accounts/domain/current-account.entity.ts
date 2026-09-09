export interface CurrentAccountMovementVo {
  id?: string;
  tenantId: string;
  currentAccountId: string;
  date: Date;
  description: string;
  referenceType: string;
  referenceNo?: string;
  debit: number;
  credit: number;
  balanceAfter: number;
}

export interface CurrentAccountProps {
  id?: string;
  tenantId: string;
  customerId: string;
  totalDebits?: number;
  totalCredits?: number;
  balance?: number;
  creditLimit?: number;
  isBlocked?: boolean;
  customer?: any;
  movements?: CurrentAccountMovementVo[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class CurrentAccountEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly customerId: string;
  public totalDebits: number;
  public totalCredits: number;
  public balance: number;
  public creditLimit: number;
  public isBlocked: boolean;
  public customer?: any;
  public movements: CurrentAccountMovementVo[];
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: CurrentAccountProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.totalDebits = props.totalDebits ?? 0;
    this.totalCredits = props.totalCredits ?? 0;
    this.balance = props.balance ?? 0;
    this.creditLimit = props.creditLimit ?? 0;
    this.isBlocked = props.isBlocked ?? false;
    this.customer = props.customer;
    this.movements = props.movements ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public hasSufficientCreditLimit(amount: number): boolean {
    if (this.creditLimit <= 0) return true; // Limit tanımlanmamışsa sınırsız kabul edilir
    const potentialBalance = this.balance + amount;
    return potentialBalance <= this.creditLimit;
  }

  public addDebit(amount: number, description: string, referenceType: string, referenceNo?: string): void {
    if (amount <= 0) {
      throw new Error('Borç tutarı pozitif olmalıdır.');
    }
    if (this.isBlocked) {
      throw new Error('Cari hesap blokelidir, yeni borç kaydı açılamaz.');
    }

    this.totalDebits += amount;
    this.balance += amount;

    this.movements.unshift({
      tenantId: this.tenantId,
      currentAccountId: this.id || '',
      date: new Date(),
      description,
      referenceType,
      referenceNo,
      debit: amount,
      credit: 0,
      balanceAfter: this.balance,
    });
  }

  public addCredit(amount: number, description: string, referenceType: string, referenceNo?: string): void {
    if (amount <= 0) {
      throw new Error('Alacak tutarı pozitif olmalıdır.');
    }

    this.totalCredits += amount;
    this.balance -= amount;

    this.movements.unshift({
      tenantId: this.tenantId,
      currentAccountId: this.id || '',
      date: new Date(),
      description,
      referenceType,
      referenceNo,
      debit: 0,
      credit: amount,
      balanceAfter: this.balance,
    });
  }

  public recalculateBalance(): void {
    this.balance = this.totalDebits - this.totalCredits;
  }

  public setBlockStatus(blocked: boolean): void {
    this.isBlocked = blocked;
  }
}
