import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { QueueService } from '../queues/queue.service';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationDto {
  tenantId?: string;
  userId?: string;
  actorUserId?: string; // İşlemi yapan kullanıcı (kendi ekranında zil çalmaz)
  targetRoles?: string[]; // Hedef roller (örn: ['OWNER', 'CASHIER'])
  type?: NotificationType;
  category: 'APPOINTMENT' | 'WORK_ORDER' | 'INVENTORY' | 'FINANCE' | 'SECURITY' | 'SYSTEM';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
  recipientPhone?: string;
  recipientEmail?: string;
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
  ) {}

  /**
   * Bireysel Gelen Kutusu (Fan-Out):
   * Servis içindeki her bir yetkili personel için bağımsız birer bildirim kaydı oluşturur,
   * veritabanına yazar, WebSocket ile canlı fırlatır ve BullMQ kuyruğuna ekler.
   */
  async createNotification(dto: CreateNotificationDto) {
    try {
      const metadata = {
        ...(dto.metadata || {}),
        actorUserId: dto.actorUserId,
        targetRoles: dto.targetRoles,
      };

      // 1. Hedef Personelleri Belirle (Fan-Out)
      let targetUserIds: string[] = [];

      if (dto.userId) {
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
        this.eventsGateway.emitToUser(dto.userId, 'notification:new', primaryNotif || dto);
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

      // 4. Asenkron Arka Plan Bildirim Kuyruğu (BullMQ)
      if (dto.sendSms && dto.recipientPhone) {
        await this.queueService.addNotificationJob('send-sms', {
          to: dto.recipientPhone,
          message: `${dto.title}: ${dto.message}`,
          tenantId: dto.tenantId,
          metadata: dto.metadata,
        });
      }

      if (dto.sendWhatsApp && dto.recipientPhone) {
        await this.queueService.addNotificationJob('send-whatsapp', {
          to: dto.recipientPhone,
          message: `${dto.title}: ${dto.message}`,
          tenantId: dto.tenantId,
          metadata: dto.metadata,
        });
      }

      if (dto.sendEmail && dto.recipientEmail) {
        await this.queueService.addNotificationJob('send-email', {
          to: dto.recipientEmail,
          subject: dto.title,
          message: dto.message,
          tenantId: dto.tenantId,
          metadata: dto.metadata,
        });
      }

      return primaryNotif;
    } catch (err: any) {
      this.logger.error(`Failed to create notification: ${err.message}`, err.stack);
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
    if (options.role && (options.role === 'TECHNICIAN' || options.role === 'WAREHOUSE_KEEPER')) {
      if (!where.category) {
        where.category = { not: 'FINANCE' };
      } else if (where.category === 'FINANCE') {
        return { data: [], meta: { page, limit, total: 0, unreadCount: 0, totalPages: 1 } };
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
}
