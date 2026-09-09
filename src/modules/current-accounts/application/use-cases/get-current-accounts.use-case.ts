import { Injectable, Inject } from '@nestjs/common';
import { ICurrentAccountRepository, CURRENT_ACCOUNT_REPOSITORY } from '../../domain/current-account.repository.interface';
import { CurrentAccountEntity } from '../../domain/current-account.entity';

@Injectable()
export class GetCurrentAccountsUseCase {
  constructor(
    @Inject(CURRENT_ACCOUNT_REPOSITORY)
    private readonly currentAccountRepository: ICurrentAccountRepository,
  ) {}

  async execute(tenantId: string): Promise<CurrentAccountEntity[]> {
    return this.currentAccountRepository.findAll(tenantId);
  }
}
