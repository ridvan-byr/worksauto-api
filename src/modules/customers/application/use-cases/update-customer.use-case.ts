import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
} from '../../domain/customer.repository.interface';
import { CustomerEntity, CustomerTypeVo } from '../../domain/customer.entity';

export interface UpdateCustomerInput {
  type?: CustomerTypeVo;
  firstName?: string;
  lastName?: string;
  companyTitle?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  taxOffice?: string;
  creditLimit?: number;
  notes?: string;
  isLead?: boolean;
}

@Injectable()
export class UpdateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    dto: UpdateCustomerInput,
  ): Promise<CustomerEntity> {
    const customer = await this.customerRepository.findById(tenantId, id);
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    if (dto.phone) {
      const cleanPhone = dto.phone.replace(/[\s()-]/g, '');
      const existing = await this.customerRepository.findByPhone(
        tenantId,
        cleanPhone,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Bu telefon numarası başka bir müşteri tarafından kullanılmaktadır.',
        );
      }
      customer.phone = cleanPhone;
    }

    if (dto.firstName !== undefined) customer.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) customer.lastName = dto.lastName.trim();
    if (dto.type !== undefined) customer.type = dto.type;
    if (dto.companyTitle !== undefined)
      customer.companyTitle = dto.companyTitle?.trim();
    if (dto.email !== undefined) customer.email = dto.email?.trim();
    if (dto.taxNumber !== undefined) customer.taxNumber = dto.taxNumber?.trim();
    if (dto.taxOffice !== undefined) customer.taxOffice = dto.taxOffice?.trim();
    if (dto.creditLimit !== undefined)
      customer.updateCreditLimit(dto.creditLimit);
    if (dto.notes !== undefined) customer.notes = dto.notes?.trim();
    if (dto.isLead !== undefined) customer.isLead = dto.isLead;

    return this.customerRepository.save(customer);
  }
}
