import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';

export const QUEUE_NOTIFICATIONS = 'worksauto_notifications';
export const QUEUE_MAINTENANCE = 'worksauto_maintenance';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private notificationsQueue: Queue | null = null;
  private maintenanceQueue: Queue | null = null;

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
      this.notificationsQueue = new Queue(QUEUE_NOTIFICATIONS, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });

      this.maintenanceQueue = new Queue(QUEUE_MAINTENANCE, {
        connection,
        defaultJobOptions: {
          attempts: 2,
          removeOnComplete: 50,
        },
      });

      this.logger.log(
        '🐂 BullMQ Queues initialized (notifications, maintenance)',
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to initialize BullMQ Queues: ${err.message}. System continues in fail-open mode.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.notificationsQueue) {
      await this.notificationsQueue.close();
    }
    if (this.maintenanceQueue) {
      await this.maintenanceQueue.close();
    }
  }

  /**
   * Bildirim kuyruğuna asenkron iş ekler (SMS, WhatsApp, Push, E-Posta)
   */
  async addNotificationJob(name: string, data: any, opts?: JobsOptions) {
    if (!this.notificationsQueue) {
      this.logger.debug(
        `Notification queue unavailable, bypassing async job ${name}`,
      );
      return null;
    }
    return this.notificationsQueue.add(name, data, opts);
  }

  /**
   * Randevu zamanı için gecikmeli (Delayed) hatırlatıcı işi planlar
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    delayMs: number,
    data: any,
  ) {
    if (!this.notificationsQueue) return null;
    return this.notificationsQueue.add(
      'appointment-reminder',
      { appointmentId, ...data },
      {
        delay: Math.max(0, delayMs),
        jobId: `reminder-app-${appointmentId}`,
        removeOnComplete: true,
      },
    );
  }
}
