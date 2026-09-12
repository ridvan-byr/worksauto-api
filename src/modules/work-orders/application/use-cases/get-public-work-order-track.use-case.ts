import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class GetPublicWorkOrderTrackUseCase {
  constructor(private readonly prisma: PrismaService) {}

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
    const raw = tokenOrNumber.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    const whereClause = isUuid
      ? { id: raw }
      : { workOrderNumber: { equals: raw, mode: 'insensitive' as const } };

    const wo: any = await this.prisma.workOrder.findFirst({
      where: whereClause,
      include: {
        tenant: {
          select: {
            title: true,
            phone: true,
            address: true,
            city: true,
            district: true,
            logoUrl: true,
          },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            plate: true,
            brand: true,
            model: true,
            year: true,
            currentKm: true,
            color: true,
          },
        },
        items: {
          select: {
            id: true,
            itemType: true,
            name: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        photos: {
          select: {
            id: true,
            url: true,
            photoType: true,
            caption: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        assignedMechanic: {
          include: {
            user: {
              select: {
                name: true,
                surname: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            paidAmount: true,
            remainingAmount: true,
            status: true,
          },
        },
      },
    });

    if (!wo) {
      throw new NotFoundException('İş emri veya araç takip kaydı bulunamadı.');
    }

    const mechanicName = wo.assignedMechanic?.user
      ? `${wo.assignedMechanic.user.name} ${wo.assignedMechanic.user.surname || ''}`.trim()
      : 'Atölye Sorumlusu';

    const customerMasked = `${this.maskName(wo.customer?.firstName)} ${this.maskName(wo.customer?.lastName)}`;
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
        name: customerMasked,
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
      photos: (wo.photos || []).map((photo) => ({
        id: photo.id,
        url: photo.url,
        type: photo.photoType,
        caption: photo.caption,
      })),
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
