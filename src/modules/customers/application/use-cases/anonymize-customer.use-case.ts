import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';

@Injectable()
export class AnonymizeCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    userId: string,
    legalRef: string,
  ): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(tenantId, id);
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    return this.customerRepository.anonymizeCustomer(
      tenantId,
      id,
      userId,
      legalRef,
    );
  }
}
