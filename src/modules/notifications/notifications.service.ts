import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { QueueService } from '../queues/queue.service';
import { NotificationType } from '@prisma/client';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from './providers/notification-provider.interface';

export interface CreateNotificationDto {
  tenantId?: string;
  userId?: string;
  actorUserId?: string; // İşlemi yapan kullanıcı (kendi ekranında zil çalmaz)
  targetRoles?: string[]; // Hedef roller (örn: ['OWNER', 'CASHIER'])
  type?: NotificationType;
  category:
    | 'APPOINTMENT'
    | 'WORK_ORDER'
    | 'INVENTORY'
    | 'FINANCE'
    | 'SECURITY'
    | 'SYSTEM';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  recipientPhone?: string;
  recipientEmail?: string;
  customerMessage?: string; // Müşteriye özel WhatsApp/SMS mesaj metni (iç personel bildiriminden bağımsız, linkli)
  customerHtml?: string; // Müşteriye özel HTML e-posta gövdesi
  sendSms?: boolean;
  sendWhatsApp?: boolean;
  sendEmail?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly queueService: QueueService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  /**
   * Bireysel Gelen Kutusu (Fan-Out):
   * Servis içindeki her bir yetkili personel için bağımsız birer bildirim kaydı oluşturur,
   * veritabanına yazar, WebSocket ile canlı fırlatır ve BullMQ kuyruğuna ekler.
   */
  async createNotification(dto: CreateNotificationDto) {
    try {
      const metadata = {
        ...dto.metadata,
        actorUserId: dto.actorUserId,
        targetRoles: dto.targetRoles,
      };

      // 1. Hedef Personelleri Belirle (Fan-Out)
      let targetUserIds: string[] = [];

      if (dto.userId) {
        // Kendi kendine bildirim gitmesini engelle
        if (dto.actorUserId && dto.userId === dto.actorUserId) {
          return null;
        }
        targetUserIds = [dto.userId];
      } else if (dto.tenantId) {
        const users = await this.prisma.user.findMany({
          where: {
            tenantId: dto.tenantId,
            isActive: true,
            ...(dto.targetRoles && dto.targetRoles.length > 0
              ? { role: { in: dto.targetRoles as any } }
              : {}),
            ...(dto.actorUserId ? { id: { not: dto.actorUserId } } : {}),
          },
          select: { id: true },
        });
        targetUserIds = users.map((u) => u.id);
      }

      // 2. Her bir hedef personele özel bağımsız bildirim satırı oluştur
      let primaryNotif: any = null;

      if (targetUserIds.length > 0) {
        const notificationsData = targetUserIds.map((uid) => ({
          tenantId: dto.tenantId,
          userId: uid,
          type: dto.type || NotificationType.INFO,
          category: dto.category,
          title: dto.title,
          message: dto.message,
          link: dto.link,
          metadata,
        }));

        await this.prisma.notification.createMany({
          data: notificationsData,
        });

        primaryNotif = {
          ...notificationsData[0],
          id: 'fanout-' + Date.now(),
          createdAt: new Date().toISOString(),
          isRead: false,
        };
      }

      // 3. WebSocket Canlı Yayın (Actor Exclusion & Role Filtering)
      if (dto.userId) {
        if (!dto.actorUserId || dto.userId !== dto.actorUserId) {
          this.eventsGateway.emitToUser(
            dto.userId,
            'notification:new',
            primaryNotif || dto,
          );
        }
      } else if (dto.tenantId) {
        this.eventsGateway.emitToTenantExcept(
          dto.tenantId,
          dto.actorUserId,
          'notification:new',
          primaryNotif || dto,
          dto.targetRoles,
        );
      } else {
        this.eventsGateway.emitToAdmin('notification:new', primaryNotif || dto);
      }

      // 4. Asenkron Arka Plan Bildirim Kuyruğu (BullMQ) & Kanal Tercihleri
      let tenantSettings: any = null;
      if (dto.tenantId) {
        try {
          tenantSettings =
            await this.prisma.tenantNotificationSetting.findUnique({
              where: { tenantId: dto.tenantId },
            });
        } catch (e: any) {
          this.logger.debug(
            `Could not load tenant notification settings: ${e.message}`,
          );
        }
      }

      // Kanal bazlı aktiflik kontrolü (Atölye panelindeki doğrudan tercihlere %100 uyar)
      const canSendWhatsApp =
        dto.sendWhatsApp &&
        (tenantSettings ? tenantSettings.whatsappEnabled : true);
      const canSendSms =
        dto.sendSms && (tenantSettings ? tenantSettings.smsEnabled : true);
      const canSendEmail =
        dto.sendEmail && (tenantSettings ? tenantSettings.emailEnabled : true);

      // DND (Do Not Disturb): Gece 21:30 - 08:30 arası dış müşteri bildirimlerini sabah 09:00'a ertele
      let nightDelayMs = 0;
      if (dto.customerMessage && dto.recipientPhone) {
        const now = new Date();
        const localHour = (now.getUTCHours() + 3) % 24; // Türkiye Saati (UTC+3)
        const localMinute = now.getUTCMinutes();
        const currentTotalMinutes = localHour * 60 + localMinute;
        const nightStartMinutes = 21 * 60 + 30; // 21:30
        const morningEndMinutes = 8 * 60 + 30; // 08:30

        const isNightTime =
          currentTotalMinutes >= nightStartMinutes ||
          currentTotalMinutes < morningEndMinutes;

        if (isNightTime) {
          let minutesUntilNineAm = 0;
          if (currentTotalMinutes >= nightStartMinutes) {
            minutesUntilNineAm = 24 * 60 - currentTotalMinutes + 9 * 60;
          } else {
            minutesUntilNineAm = 9 * 60 - currentTotalMinutes;
          }
          nightDelayMs = minutesUntilNineAm * 60 * 1000;
          this.logger.log(
            `🌙 DND (Gece Koruması) Aktif: Müşteri bildirimi sabah 09:00 için kuyruğa ertelendi (${minutesUntilNineAm} dk gecikme)`,
          );
        }
      }

      const queueOpts = nightDelayMs > 0 ? { delay: nightDelayMs } : undefined;
      const outgoingMessage =
        dto.customerMessage || `${dto.title}: ${dto.message}`;

      if (canSendSms && dto.recipientPhone) {
        await this.queueService.addNotificationJob(
          'send-sms',
          {
            to: dto.recipientPhone,
            message: outgoingMessage,
            tenantId: dto.tenantId,
            metadata: dto.metadata,
          },
          queueOpts,
        );
      }

      if (canSendWhatsApp && dto.recipientPhone) {
        await this.queueService.addNotificationJob(
          'send-whatsapp',
          {
            to: dto.recipientPhone,
            message: outgoingMessage,
            tenantId: dto.tenantId,
            metadata: dto.metadata,
          },
          queueOpts,
        );
      }

      if (canSendEmail && dto.recipientEmail) {
        await this.queueService.addNotificationJob(
          'send-email',
          {
            to: dto.recipientEmail,
            subject: dto.title,
            message: outgoingMessage,
            html: dto.customerHtml,
            tenantId: dto.tenantId,
            metadata: dto.metadata,
          },
          queueOpts,
        );
      }

      return primaryNotif;
    } catch (err: any) {
      this.logger.error(
        `Failed to create notification: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Yalnızca oturum açmış kullanıcının BİREYSEL bildirimlerini sayfalamalı olarak listeler
   */
  async findAll(options: {
    tenantId?: string;
    userId?: string;
    role?: string;
    category?: string;
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 15));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.userId) where.userId = options.userId;

    if (options.unreadOnly) {
      where.isRead = false;
    }

    // Kategori filtresi
    if (options.category && options.category !== 'ALL') {
      where.category = options.category;
    }

    // Rol bazlı gizlilik (Teknisyen / Depocu finansal bildirimleri göremez)
    if (
      options.role &&
      (options.role === 'TECHNICIAN' || options.role === 'WAREHOUSE_KEEPER')
    ) {
      if (!where.category) {
        where.category = { not: 'FINANCE' };
      } else if (where.category === 'FINANCE') {
        return {
          data: [],
          meta: { page, limit, total: 0, unreadCount: 0, totalPages: 1 },
        };
      }
    }

    const [total, unreadCount, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        unreadCount,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Yalnızca geçerli kullanıcının bildirimini okundu olarak işaretler
   */
  async markAsRead(id: string, tenantId?: string, userId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    await this.prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (userId) {
      this.eventsGateway.emitToUser(userId, 'notification:read', { id });
    }

    return { success: true };
  }

  /**
   * Bildirimi yalnızca geçerli kullanıcının gelen kutusundan siler
   */
  async remove(id: string, tenantId?: string, userId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    await this.prisma.notification.deleteMany({
      where,
    });

    if (userId) {
      this.eventsGateway.emitToUser(userId, 'notification:deleted', { id });
    }

    return { success: true };
  }

  /**
   * Yalnızca oturum açmış kullanıcının bildirimlerini okundu yapar (Diğer personeller etkilenmez)
   */
  async markAllAsRead(tenantId?: string, userId?: string) {
    const where: any = { isRead: false };
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    await this.prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (userId) {
      this.eventsGateway.emitToUser(userId, 'notification:read_all', {});
    }

    return { success: true };
  }

  /**
   * Yalnızca oturum açmış kullanıcının BİREYSEL okunmamış bildirim sayısını döner
   */
  async getUnreadCount(tenantId?: string, userId?: string, role?: string) {
    const where: any = { isRead: false };
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    if (role && (role === 'TECHNICIAN' || role === 'WAREHOUSE_KEEPER')) {
      where.category = { not: 'FINANCE' };
    }

    const count = await this.prisma.notification.count({ where });
    return { count, unreadCount: count };
  }

  /**
   * WhatsApp Gateway Cihaz Durumunu Sorgular
   */
  async getWhatsAppStatus(_tenantId?: string) {
    if (this.provider.getWhatsAppStatus) {
      return this.provider.getWhatsAppStatus('default');
    }
    return { connected: false, state: 'not_supported' };
  }

  /**
   * WhatsApp Eşleştirmesi İçin Yeni QR Kod İster
   */
  async getWhatsAppQr(_tenantId?: string) {
    if (this.provider.getWhatsAppQr) {
      return this.provider.getWhatsAppQr('default');
    }
    return { success: false, error: 'QR kod desteklenmiyor' };
  }

  /**
   * WhatsApp Cihaz Bağlantısını Keser / Oturumu Kapatır
   */
  async disconnectWhatsApp(_tenantId?: string) {
    if (this.provider.disconnectWhatsApp) {
      return this.provider.disconnectWhatsApp('default');
    }
    return { success: false, error: 'Çıkış desteklenmiyor' };
  }

  /**
   * Belirtilen telefona anlık canlı test mesajı gönderir
   */
  async sendWhatsAppTestMessage(
    phone: string,
    message?: string,
    tenantId?: string,
  ) {
    const msg =
      message ||
      '🚗 WorksAuto WhatsApp Bildirim Testi: Bu mesaj sisteminizin başarıyla bağlandığını doğrulamaktadır. İyi çalışmalar dileriz!';

    const result = await this.provider.sendWhatsApp({
      to: phone,
      message: msg,
      tenantId,
    });

    return result;
  }

  /**
   * Belirtilen e-posta adresine anlık canlı test e-postası gönderir
   */
  async sendEmailTestMessage(
    to: string,
    subject?: string,
    message?: string,
    tenantId?: string,
  ) {
    const sub = subject || '🚗 WorksAuto E-Posta Bildirim Testi';
    const msg =
      message ||
      'WorksAuto E-Posta Entegrasyonu başarıyla aktifleştirildi. Sistem üzerinden servis bildirimleri, iş emri durumları ve fatura bilgilendirmeleri aktif olarak iletilecektir.';

    const result = await this.provider.sendEmail({
      to,
      subject: sub,
      message: msg,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">🚗 WorksAuto E-Posta Testi</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">${msg}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">Bu e-posta WorksAuto servis yönetim sistemi tarafından otomatik olarak gönderilmiştir.</p>
        </div>
      `,
      tenantId,
    });

    return result;
  }
}
