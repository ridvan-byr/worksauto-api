import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QUEUE_NOTIFICATIONS } from '../../queues/queue.service';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../providers/notification-provider.interface';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  private worker: Worker | null = null;

  constructor(
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
    private readonly eventsGateway: EventsGateway,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;

    const connection = {
      host,
      port,
      password,
      maxRetriesPerRequest: null as any,
    };

    try {
      this.worker = new Worker(
        QUEUE_NOTIFICATIONS,
        async (job: Job) => {
          return this.processJob(job);
        },
        {
          connection,
          concurrency: 5,
        }
      );

      this.worker.on('completed', (job: Job) => {
        this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
      });

      this.worker.on('failed', (job: Job | undefined, err: Error) => {
        this.logger.warn(`Job ${job?.id} (${job?.name}) failed: ${err.message}`);
      });

      this.logger.log('👷 BullMQ NotificationWorker started processing jobs');
    } catch (err: any) {
      this.logger.warn(`NotificationWorker init error: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async processJob(job: Job) {
    const { name, data } = job;
    this.logger.log(`Processing background notification job [${name}] (ID: ${job.id})`);

    switch (name) {
      case 'send-sms':
        return this.provider.sendSms(data);

      case 'send-whatsapp':
        return this.provider.sendWhatsApp(data);

      case 'send-email':
        return this.provider.sendEmail(data);

      case 'appointment-reminder':
        return this.handleAppointmentReminder(data);

      default:
        this.logger.warn(`Unknown job name: ${name}`);
        return null;
    }
  }

  private async handleAppointmentReminder(data: {
    appointmentId: string;
    customerName?: string;
    customerPhone?: string;
    plate?: string;
    tenantId?: string;
    slotDate?: string;
    slotTime?: string;
  }) {
    if (!data.appointmentId) return;

    // Randevunun hala aktif (iptal edilmemiş) olduğunu doğrula
    const appt = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { customer: true, vehicle: true, tenant: true },
    });

    if (!appt || appt.status === 'CANCELLED' || appt.status === 'COMPLETED' || appt.status === 'NO_SHOW') {
      this.logger.log(`Appointment ${data.appointmentId} is ${appt?.status || 'NOT_FOUND'}, skipping reminder.`);
      return;
    }

    const tenantTitle = appt.tenant?.title || 'Oto Servisiniz';
    const plate = appt.vehicle?.plate || data.plate || '';
    const dateStr = appt.slotDate ? new Date(appt.slotDate).toLocaleDateString('tr-TR') : data.slotDate || '';
    const phone = appt.customer?.phone || data.customerPhone;

    if (phone) {
      const message = `Sayın ${appt.customer?.firstName || 'Müşterimiz'}, ${plate} plakalı aracınızın ${dateStr} tarihindeki servis randevusunu hatırlatırız. İyi günler dileriz. - ${tenantTitle}`;
      await this.provider.sendSms({
        to: phone,
        recipientName: `${appt.customer?.firstName} ${appt.customer?.lastName}`,
        message,
        tenantId: appt.tenantId,
      });
    }

    // Uygulama içine hatırlatma bildirimi kaydet ve WebSocket yayını yap
    if (appt.tenantId) {
      const notif = await this.prisma.notification.create({
        data: {
          tenantId: appt.tenantId,
          type: 'INFO',
          category: 'APPOINTMENT',
          title: `Randevu Hatırlatması: ${plate}`,
          message: `${appt.customer?.firstName} ${appt.customer?.lastName} müşterinizin ${dateStr} randevusu için otomatik hatırlatma iletildi.`,
          link: '/appointments',
          metadata: {
            appointmentId: appt.id,
            plate,
            phone,
          },
        },
      });

      this.eventsGateway.emitToTenant(appt.tenantId, 'notification:new', notif);
      this.eventsGateway.emitToTenant(appt.tenantId, 'appointment:reminder', {
        appointmentId: appt.id,
        plate,
        customerName: `${appt.customer?.firstName} ${appt.customer?.lastName}`,
      });
    }
  }
}
