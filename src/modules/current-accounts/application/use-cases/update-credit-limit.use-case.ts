import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ICurrentAccountRepository,
  CURRENT_ACCOUNT_REPOSITORY,
} from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';

@Injectable()
export class UpdateCreditLimitUseCase {
  constructor(
    @Inject(CURRENT_ACCOUNT_REPOSITORY)
    private readonly repository: ICurrentAccountRepository,
  ) {}

  async execute(
    tenantId: string,
    customerId: string,
    creditLimit: number,
    isBlocked?: boolean,
  ): Promise<CurrentAccountEntity> {
    let account = await this.repository.findByCustomerId(tenantId, customerId);

    if (!account) {
      const exists = await this.repository.customerExists(tenantId, customerId);
      if (!exists) {
        throw new NotFoundException('Müşteri bulunamadı.');
      }
      account = new CurrentAccountEntity({
        tenantId,
        customerId,
        creditLimit,
        isBlocked: isBlocked ?? false,
      });
      return this.repository.create(account);
    }

    account.creditLimit = creditLimit;
    if (isBlocked !== undefined) {
      account.isBlocked = isBlocked;
    }

    return this.repository.save(account);
  }
}
