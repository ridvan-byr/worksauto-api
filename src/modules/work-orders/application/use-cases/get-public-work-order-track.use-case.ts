import { Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { MediaService } from '../../../media/media.service';

@Injectable()
export class GetPublicWorkOrderTrackUseCase {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    @Optional()
    private readonly mediaService?: MediaService,
  ) {}

  private maskName(name?: string | null): string {
    if (!name) return 'Değerli Müşterimiz';
    const trimmed = name.trim();
    if (trimmed.length <= 2) return trimmed + '*';
    return trimmed.slice(0, 2) + '*'.repeat(Math.max(2, trimmed.length - 2));
  }

  private maskPhone(phone?: string | null): string {
    if (!phone) return '05** *** ** **';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return '05** *** ** **';
    const last2 = clean.slice(-2);
    const first3 = clean.slice(clean.length - 10, clean.length - 7);
    return `0${first3} *** ** ${last2}`;
  }

  async execute(tokenOrNumber: string) {
    const wo: any = await this.workOrderRepository.findPublicTrackByTokenOrNumber(tokenOrNumber);

    if (!wo) {
      throw new NotFoundException('İş emri veya araç takip kaydı bulunamadı.');
    }

    const mechanicName = wo.assignedMechanic?.user
      ? `${wo.assignedMechanic.user.name} ${wo.assignedMechanic.user.surname || ''}`.trim()
      : 'Atölye Sorumlusu';

    const customerFullName = wo.customer
      ? `${wo.customer.firstName || ''} ${wo.customer.lastName || ''}`.trim() || 'Değerli Müşterimiz'
      : 'Değerli Müşterimiz';
    const phoneMasked = this.maskPhone(wo.customer?.phone);

    const services = (wo.items || [])
      .filter((i) => i.itemType === 'SERVICE')
      .map((s) => ({
        id: s.id,
        name: s.name,
        completed: wo.status === 'COMPLETED',
      }));

    const parts = (wo.items || [])
      .filter((i) => i.itemType === 'PART')
      .map((p) => ({
        id: p.id,
        name: p.name,
        quantity: Number(p.quantity),
      }));

    const photos = await Promise.all(
      (wo.photos || []).map(async (photo: any) => {
        let displayUrl = photo.url;
        if (this.mediaService && photo.url && wo.tenantId) {
          try {
            const presigned = await this.mediaService.getPresignedUrl(
              wo.tenantId,
              photo.url,
              86400, // 24 hours valid
            );
            if (presigned) displayUrl = presigned;
          } catch {
            displayUrl = photo.url;
          }
        }
        return {
          id: photo.id,
          url: displayUrl,
          rawUrl: photo.url,
          display_url: displayUrl,
          type: photo.photoType,
          caption: photo.caption,
        };
      }),
    );

    return {
      workOrderNumber: wo.workOrderNumber,
      status: wo.status,
      createdAt: wo.createdAt,
      completedAt: wo.completedAt,
      initialKm: wo.initialKm,
      fuelLevel: wo.fuelLevel,
      assignedLift: wo.assignedLift || 'Mekanik Lift',
      mechanicName,
      customer: {
        name: customerFullName,
        phone: phoneMasked,
      },
      vehicle: {
        plate: wo.vehicle?.plate || 'Plaka Belirtilmedi',
        brand: wo.vehicle?.brand || '',
        model: wo.vehicle?.model || '',
        year: wo.vehicle?.year || null,
        kilometer: wo.initialKm || wo.vehicle?.currentKm || 0,
        color: wo.vehicle?.color || null,
      },
      services,
      parts,
      photos,
      tenant: wo.tenant,
      invoice: wo.invoice
        ? {
            id: wo.invoice.id,
            invoiceNumber: wo.invoice.invoiceNumber,
            grandTotal: Number(wo.invoice.grandTotal),
            paidAmount: Number(wo.invoice.paidAmount),
            remainingAmount: Number(wo.invoice.remainingAmount),
            status: wo.invoice.status,
            isPaid: wo.invoice.status === 'PAID',
          }
        : null,
    };
  }
}
