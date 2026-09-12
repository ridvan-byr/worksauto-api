import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PayTrService } from './infrastructure/paytr.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queues/queue.module';

@Module({
  imports: [EventsModule, NotificationsModule, QueueModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayTrService, PrismaService],
  exports: [PaymentsService, PayTrService],
})
export class PaymentsModule {}
