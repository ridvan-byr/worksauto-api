import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';

@Injectable()
export class AddWorkOrderPhotoUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
  ) {}

  async execute(tenantId: string, id: string, url: string, caption: string, photoType: string, uploadedBy: string) {
    const wo = await this.workOrderRepository.findById(tenantId, id);
    if (!wo) throw new NotFoundException('İş emri bulunamadı.');

    return this.workOrderRepository.addPhoto(tenantId, id, url, caption, photoType, uploadedBy);
  }
}
