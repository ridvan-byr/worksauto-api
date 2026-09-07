import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { IAppointmentRepository, APPOINTMENT_REPOSITORY } from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';
import { AuditService } from '../../../audit/audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EventsGateway } from '../../../events/events.gateway';
import { NotificationType } from '@prisma/client';

export interface RescheduleAppointmentInput {
  slotDate: string; // YYYY-MM-DD
  slotStartTime: string; // ISO
  slotEndTime: string; // ISO
  assignedMechanicId?: string;
  assignedLift?: string;
}

@Injectable()
export class RescheduleAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    dto: RescheduleAppointmentInput,
    userId?: string,
  ): Promise<AppointmentEntity> {
    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }

    if (!app.canReschedule()) {
      throw new BadRequestException('Tamamlanmış veya iptal edilmiş randevular yeniden planlanamaz.');
    }

    const start = new Date(dto.slotStartTime);
    const end = new Date(dto.slotEndTime);
    const mechanicId = dto.assignedMechanicId !== undefined ? dto.assignedMechanicId : app.assignedMechanicId;
    const lift = dto.assignedLift !== undefined ? dto.assignedLift : app.assignedLift;

    if (mechanicId) {
      const conflict = await this.appointmentRepository.checkMechanicConflict(
        tenantId,
        mechanicId,
        start,
        end,
        id,
      );
      if (conflict) {
        throw new ConflictException('Seçilen teknisyenin bu saat aralığında başka bir randevusu bulunmaktadır.');
      }
    }

    if (lift) {
      const conflict = await this.appointmentRepository.checkLiftConflict(
        tenantId,
        lift,
        start,
        end,
        id,
      );
      if (conflict) {
        throw new ConflictException(`"${lift}" için bu saat aralığında başka bir randevu bulunmaktadır.`);
      }
    }

    const oldDate = app.slotDate;
    const oldStart = app.slotStartTime;

    app.reschedule(new Date(dto.slotDate), start, end, dto.assignedMechanicId, dto.assignedLift);
    const updated = await this.appointmentRepository.save(app);

    this.eventsGateway.emitToTenant(tenantId, 'appointment:rescheduled', updated);

    await this.notificationsService.createNotification({
      tenantId,
      targetRoles: ['OWNER', 'SERVICE_MANAGER', 'TECHNICIAN'],
      type: NotificationType.INFO,
      category: 'APPOINTMENT',
      title: 'Randevu Yeniden Planlandı',
      message: `Randevu saati güncellendi: ${dto.slotDate} (${new Date(dto.slotStartTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`,
      link: '/appointments',
      metadata: { appointmentId: id },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'appointment.rescheduled',
      entityName: 'Appointment',
      entityId: id,
      changesBefore: { slotDate: oldDate, slotStartTime: oldStart },
      changesAfter: { slotDate: dto.slotDate, slotStartTime: dto.slotStartTime },
    });

    return updated;
  }
}
