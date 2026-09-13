import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../domain/customer.repository.interface';
import { CustomerEntity } from '../../domain/customer.entity';

@Injectable()
export class RestoreCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<CustomerEntity> {
    const restored = await this.customerRepository.restore(tenantId, id);
    if (!restored) {
      throw new NotFoundException('Arşivlenmiş müşteri bulunamadı.');
    }
    return restored;
  }

  async checkPhone(tenantId: string, rawPhone: string) {
    const cleanPhone = rawPhone.replace(/[\s()-]/g, '');
    const active = await this.customerRepository.findByPhone(tenantId, cleanPhone);
    if (active) {
      return {
        exists: true,
        isDeleted: false,
        customer: active,
      };
    }

    const deleted = await this.customerRepository.findDeletedByPhone(
      tenantId,
      cleanPhone,
    );
    if (deleted) {
      return {
        exists: true,
        isDeleted: true,
        customer: deleted,
      };
    }

    return {
      exists: false,
      isDeleted: false,
    };
  }
}
