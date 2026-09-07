import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queues/queue.module';

import { APPOINTMENT_REPOSITORY } from './domain/appointment.repository.interface';
import { PrismaAppointmentRepository } from './infrastructure/prisma-appointment.repository';

import { AppointmentsController } from './presentation/appointments.controller';
import { GetAppointmentsUseCase } from './application/use-cases/get-appointments.use-case';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case';
import { RescheduleAppointmentUseCase } from './application/use-cases/reschedule-appointment.use-case';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case';
import { CreatePublicAppointmentUseCase } from './application/use-cases/create-public-appointment.use-case';
import { UpdateAppointmentStatusUseCase } from './application/use-cases/update-appointment-status.use-case';

@Module({
  imports: [AuditModule, NotificationsModule, EventsModule, QueueModule],
  controllers: [AppointmentsController],
  providers: [
    PrismaService,
    {
      provide: APPOINTMENT_REPOSITORY,
      useClass: PrismaAppointmentRepository,
    },
    GetAppointmentsUseCase,
    CreateAppointmentUseCase,
    RescheduleAppointmentUseCase,
    CancelAppointmentUseCase,
    CreatePublicAppointmentUseCase,
    UpdateAppointmentStatusUseCase,
  ],
  exports: [
    APPOINTMENT_REPOSITORY,
    GetAppointmentsUseCase,
    CreateAppointmentUseCase,
    RescheduleAppointmentUseCase,
    CancelAppointmentUseCase,
  ],
})
export class AppointmentsModule {}
