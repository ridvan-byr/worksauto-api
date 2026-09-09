import { CurrentAccountEntity } from './current-account.entity';

export const CURRENT_ACCOUNT_REPOSITORY = Symbol('CURRENT_ACCOUNT_REPOSITORY');

export interface ICurrentAccountRepository {
  findAll(tenantId: string): Promise<CurrentAccountEntity[]>;
  findByCustomerId(tenantId: string, customerId: string): Promise<CurrentAccountEntity | null>;
  customerExists(tenantId: string, customerId: string): Promise<boolean>;
  create(currentAccount: CurrentAccountEntity): Promise<CurrentAccountEntity>;
  save(currentAccount: CurrentAccountEntity): Promise<CurrentAccountEntity>;
}
