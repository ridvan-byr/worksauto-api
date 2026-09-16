import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AuditService } from '../../../audit/audit.service';
import { NotificationType } from '@prisma/client';
import { SubmitCustomerFeedbackDto } from '../../dto/customer-feedback.dto';

@Injectable()
export class SubmitCustomerFeedbackUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async execute(tokenOrNumber: string, dto: SubmitCustomerFeedbackDto) {
    const wo: any =
      await this.workOrderRepository.findPublicTrackByTokenOrNumber(
        tokenOrNumber,
      );

    if (!wo) {
      throw new NotFoundException('İş emri veya araç takip kaydı bulunamadı.');
    }

    const isPositive = dto.rating >= 4;
    const customerName = wo.customer
      ? `${wo.customer.firstName || ''} ${wo.customer.lastName || ''}`.trim()
      : 'Müşteri';
    const plate = wo.vehicle?.plate || '';

    // Persist rating & comment directly on work order record
    await this.workOrderRepository.updateCustomerFeedback(
      wo.id,
      dto.rating,
      dto.comment,
    );

    // Notify service owner/manager in the panel
    await this.notificationsService.createNotification({
      tenantId: wo.tenantId,
      type: isPositive ? NotificationType.SUCCESS : NotificationType.WARNING,
      category: 'WORK_ORDER',
      title: isPositive
        ? `Müşteri Puanı: ${dto.rating}/5 ⭐ (${plate})`
        : `⚠️ Düşük Müşteri Puanı: ${dto.rating}/5 ⭐ (${plate})`,
      message: `${customerName} (${plate}), #${wo.workOrderNumber} iş emri için ${dto.rating}/5 puan verdi.${
        dto.comment?.trim() ? ` Yorum: "${dto.comment.trim()}"` : ''
      }`,
      link: `/work-orders/${wo.id}`,
      metadata: {
        workOrderId: wo.id,
        workOrderNumber: wo.workOrderNumber,
        plate,
        rating: dto.rating,
        comment: dto.comment?.trim(),
        isPositive,
      },
    });

    await this.auditService.log({
      tenantId: wo.tenantId,
      action: 'CUSTOMER_FEEDBACK_SUBMITTED',
      entityName: 'WORK_ORDER',
      entityId: wo.id,
      changesAfter: {
        rating: dto.rating,
        comment: dto.comment?.trim(),
        isPositive,
      },
    });

    return {
      success: true,
      isPositive,
      rating: dto.rating,
      message: isPositive
        ? 'Değerlendirmeniz için teşekkür ederiz! Deneyiminizi Google Haritalar üzerinden de paylaşarak servisimize destek olabilirsiniz.'
        : 'Geri bildiriminiz kaydedildi. Servis yöneticimiz konuyla titizlikle ilgilenecektir.',
    };
  }
}
