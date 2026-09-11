import { Module, Global } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { GowaWhatsAppProvider } from './providers/gowa-whatsapp.provider';
import { NOTIFICATION_PROVIDER } from './providers/notification-provider.interface';
import { NotificationWorker } from './workers/notification.worker';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationWorker,
    PrismaService,
    {
      provide: NOTIFICATION_PROVIDER,
      useClass: GowaWhatsAppProvider,
    },
  ],
  exports: [NotificationsService, NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
