import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/appointment.repository.interface';
import { AppointmentEntity } from '../../domain/appointment.entity';

@Injectable()
export class GetAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: IAppointmentRepository,
  ) {}

  async execute(tenantId: string, date?: string): Promise<AppointmentEntity[]> {
    return this.appointmentRepository.findAll(tenantId, date);
  }

  async getById(tenantId: string, id: string): Promise<AppointmentEntity> {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new NotFoundException('Geçersiz veya bulunamayan randevu.');
    }

    const app = await this.appointmentRepository.findById(tenantId, id);
    if (!app) {
      throw new NotFoundException('Randevu bulunamadı.');
    }
    return app;
  }
}
