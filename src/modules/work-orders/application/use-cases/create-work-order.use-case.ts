import {
  Injectable,
  Inject,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { IWorkOrderRepository } from '../../domain/repositories/work-order.repository.interface';
import { WorkOrderStatusEnum } from '../../domain/value-objects/work-order-status.vo';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NotificationTemplateService } from '../../../notifications/services/notification-template.service';
import { NotificationType } from '@prisma/client';

export interface CreateWorkOrderInput {
  appointmentId?: string;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  initialKm: number;
  fuelLevel?: string;
  items?: Array<{
    itemType: 'PART' | 'SERVICE';
    itemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    kdvRate?: number;
  }>;
}

@Injectable()
export class CreateWorkOrderUseCase {
  private readonly templateService: NotificationTemplateService;

  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    @Optional()
    templateService?: NotificationTemplateService,
  ) {
    this.templateService = templateService || new NotificationTemplateService();
  }

  async execute(
    tenantId: string,
    input: CreateWorkOrderInput,
    author: string,
    actorUserId?: string,
  ) {
    // Prevent duplicate active work order for the same vehicle
    const existingActiveOrder =
      await this.workOrderRepository.findActiveByVehicleId(
        tenantId,
        input.vehicleId,
      );
    if (existingActiveOrder) {
      throw new BadRequestException(
        `Bu araca ait halen devam eden (${existingActiveOrder.status === 'IN_PROGRESS' ? 'İşlemde' : 'Kuyrukta'}) #${existingActiveOrder.workOrderNumber} numaralı bir iş emri bulunmaktadır. Aynı araca mükerrer iş emri açılamaz. Lütfen mevcut iş emrine işlem veya parça ekleyiniz.`,
      );
    }

    const woNumber =
      await this.workOrderRepository.getNextWorkOrderNumber(tenantId);

    let subtotal = 0;
    let kdvTotal = 0;
    const formattedItems = [];

    if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        const lineTotal = item.quantity * item.unitPrice;
        const kdv = lineTotal * ((item.kdvRate ?? 20) / 100);
        subtotal += lineTotal;
        kdvTotal += kdv;

        formattedItems.push({
          itemType: item.itemType || 'SERVICE',
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          kdvRate: item.kdvRate ?? 20,
          totalPrice: lineTotal,
        });
      }
    }

    const grandTotal = subtotal + kdvTotal;

    const createdWorkOrder = await this.workOrderRepository.create({
      tenantId,
      workOrderNumber: woNumber,
      appointmentId: input.appointmentId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      assignedMechanicId: input.assignedMechanicId,
      assignedLift: input.assignedLift,
      initialKm: input.initialKm,
      fuelLevel: input.fuelLevel,
      subtotal,
      kdvAmount: kdvTotal,
      grandTotal,
      status: WorkOrderStatusEnum.QUEUE,
      author,
      items: formattedItems,
    });

    // Notify & emit events
    this.eventsGateway.emitToTenant(tenantId, 'work_order:created', {
      ...createdWorkOrder,
    });

    const customer = (createdWorkOrder as any)?.customer;
    const vehicle = (createdWorkOrder as any)?.vehicle;
    const tenant = (createdWorkOrder as any)?.tenant;

    const tenantTitle = tenant?.title || 'Oto Servisiniz';
    const customerName = customer
      ? `${customer.firstName} ${customer.lastName || ''}`.trim()
      : 'Değerli Müşterimiz';
    const plate = vehicle?.plate || '';
    const trackingUrl = this.templateService.getTrackingUrl(
      createdWorkOrder.id,
    );

    const customerMsg =
      this.templateService.formatWorkOrderCreatedCustomerMessage({
        customerName,
        plate,
        workOrderNumber: woNumber,
        trackingUrl,
        tenantTitle,
      });

    const customerHtml = this.templateService.generateBrandedHtmlEmail({
      title: 'İş Emriniz Açıldı - Servis Kabulü Yapıldı',
      customerName,
      message: `${woNumber} numaralı servis iş emriniz oluşturulmuştur. Aracınızın kabul kontrolleri yapılmış olup servis sırasına alınmıştır. Yapılan işlemleri ve hasar/onarım fotoğraflarını anlık canlı takip edebilirsiniz.`,
      buttonText: 'Canlı Takip Sayfasını Aç',
      buttonUrl: trackingUrl,
      tenantTitle,
      extraDetails: {
        'İş Emri No': woNumber,
        Plaka: plate || 'Belirtilmedi',
        Aşama: 'Servis Sırasında (Kabul Edildi)',
        'Giriş Kilometresi': `${input.initialKm} km`,
      },
    });

    await this.notificationsService.createNotification({
      tenantId,
      actorUserId,
      type: NotificationType.INFO,
      category: 'WORK_ORDER',
      title: 'Yeni İş Emri Açıldı',
      message: `${woNumber} nolu iş emri kabul edildi.`,
      link: `/work-orders/${createdWorkOrder.id}`,
      metadata: {
        workOrderId: createdWorkOrder.id,
        workOrderNumber: woNumber,
        trackingUrl,
      },
      recipientPhone: customer?.phone,
      recipientEmail: customer?.email,
      customerMessage: customerMsg,
      customerHtml,
      sendSms: !!customer?.phone,
      sendWhatsApp: !!customer?.phone,
      sendEmail: !!customer?.email,
    });

    return createdWorkOrder;
  }
}

