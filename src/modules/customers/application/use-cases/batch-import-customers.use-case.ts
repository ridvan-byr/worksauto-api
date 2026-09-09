import { Injectable, Inject } from '@nestjs/common';
import { ICustomerRepository, CUSTOMER_REPOSITORY } from '../../domain/customer.repository.interface';

@Injectable()
export class BatchImportCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(tenantId: string, items: any[], options?: { updateExisting?: boolean }) {
    return this.customerRepository.batchImport(tenantId, items, options);
  }
}
