import { Injectable, Inject, ConflictException } from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../domain/customer.repository.interface';
import { CustomerEntity, CustomerTypeVo } from '../../domain/customer.entity';

export interface CreateCustomerInput {
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
}

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(
    tenantId: string,
    dto: CreateCustomerInput,
  ): Promise<CustomerEntity> {
    const cleanPhone = dto.phone.replace(/[\s()-]/g, '');

    const existing = await this.customerRepository.findByPhone(
      tenantId,
      cleanPhone,
    );
    if (existing) {
      throw new ConflictException(
        'Bu telefon numarasıyla kayıtlı bir müşteri zaten mevcut.',
      );
    }

    const entity = new CustomerEntity({
      tenantId,
      type: dto.type || 'INDIVIDUAL',
      firstName: dto.firstName.trim(),
      lastName: dto.lastName ? dto.lastName.trim() : '',
      companyTitle: dto.companyTitle?.trim(),
      phone: cleanPhone,
      email: dto.email?.trim(),
      taxNumber: dto.taxNumber?.trim(),
      taxOffice: dto.taxOffice?.trim(),
      creditLimit: dto.creditLimit ?? 0,
      notes: dto.notes?.trim(),
      isLead: dto.isLead ?? false,
    });

    return this.customerRepository.create(entity);
  }
}
