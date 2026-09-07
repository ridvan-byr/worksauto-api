import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICustomerRepository, CUSTOMER_REPOSITORY, CustomerStatsResult } from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';

@Injectable()
export class GetCustomersUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(tenantId: string, search?: string): Promise<CustomerEntity[]> {
    return this.customerRepository.findAll(tenantId, search);
  }

  async getById(tenantId: string, id: string): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(tenantId, id);
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }
    return customer;
  }

  async getStats(tenantId: string, id: string): Promise<CustomerStatsResult> {
    await this.getById(tenantId, id);
    return this.customerRepository.getCustomerStats(tenantId, id);
  }

  async softDelete(tenantId: string, id: string): Promise<CustomerEntity> {
    await this.getById(tenantId, id);
    return this.customerRepository.softDelete(tenantId, id);
  }
}
