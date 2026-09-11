import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ICurrentAccountRepository,
  CURRENT_ACCOUNT_REPOSITORY,
} from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';

@Injectable()
export class GetCustomerCurrentAccountUseCase {
  constructor(
    @Inject(CURRENT_ACCOUNT_REPOSITORY)
    private readonly currentAccountRepository: ICurrentAccountRepository,
  ) {}

  async execute(
    tenantId: string,
    customerId: string,
  ): Promise<CurrentAccountEntity> {
    let account = await this.currentAccountRepository.findByCustomerId(
      tenantId,
      customerId,
    );

    if (!account) {
      const exists = await this.currentAccountRepository.customerExists(
        tenantId,
        customerId,
      );
      if (!exists) {
        throw new NotFoundException('Müşteri bulunamadı.');
      }

      const newAccount = new CurrentAccountEntity({
        tenantId,
        customerId,
        totalDebits: 0,
        totalCredits: 0,
        balance: 0,
        creditLimit: 0,
        isBlocked: false,
      });

      account = await this.currentAccountRepository.create(newAccount);
    }

    return account;
  }
}
