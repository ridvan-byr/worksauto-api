import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';

@Injectable()
export class GetWorkOrdersUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
  ) {}

  async findAll(tenantId: string, status?: string) {
    return this.workOrderRepository.findAll(tenantId, status);
  }

  async findOne(tenantId: string, id: string) {
    const wo = await this.workOrderRepository.findById(tenantId, id);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');
    return wo;
  }
}
