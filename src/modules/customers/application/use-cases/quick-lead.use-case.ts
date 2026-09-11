import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import {
  ICustomerRepository,
  CUSTOMER_REPOSITORY,
  QuickLeadInput,
} from '../../domain/customer.repository.interface';

@Injectable()
export class QuickLeadUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(tenantId: string, dto: QuickLeadInput) {
    if (!dto.firstName || !dto.phone || !dto.plate) {
      throw new BadRequestException(
        'Müşteri adı, telefon ve araç plakası zorunludur.',
      );
    }

    const cleanPlate = dto.plate.toUpperCase().replace(/\s/g, '');
    const cleanPhone = dto.phone.replace(/[\s()-]/g, '');

    return this.customerRepository.quickLead(tenantId, {
      ...dto,
      plate: cleanPlate,
      phone: cleanPhone,
    });
  }
}
