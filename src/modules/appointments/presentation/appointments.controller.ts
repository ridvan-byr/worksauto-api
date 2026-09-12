import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole, AppointmentStatus } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import { CreatePublicAppointmentDto } from '../dto/create-public-appointment.dto';

import { GetAppointmentsUseCase } from '../application/use-cases/get-appointments.use-case';
import { CreateAppointmentUseCase } from '../application/use-cases/create-appointment.use-case';
import { RescheduleAppointmentUseCase } from '../application/use-cases/reschedule-appointment.use-case';
import { CancelAppointmentUseCase } from '../application/use-cases/cancel-appointment.use-case';
import { CreatePublicAppointmentUseCase } from '../application/use-cases/create-public-appointment.use-case';
import { UpdateAppointmentStatusUseCase } from '../application/use-cases/update-appointment-status.use-case';

@ApiTags('Appointments (Randevu Takvimi)')
@ApiBearerAuth('JWT-auth')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly getAppointmentsUseCase: GetAppointmentsUseCase,
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly rescheduleAppointmentUseCase: RescheduleAppointmentUseCase,
    private readonly cancelAppointmentUseCase: CancelAppointmentUseCase,
    private readonly createPublicAppointmentUseCase: CreatePublicAppointmentUseCase,
    private readonly updateAppointmentStatusUseCase: UpdateAppointmentStatusUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Tarihe göre randevuları listeler' })
  findAll(@CurrentTenant() tenantId: string, @Query('date') date?: string) {
    return this.getAppointmentsUseCase.execute(tenantId, date);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Randevu detayını getirir' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getAppointmentsUseCase.getById(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary: 'Yeni randevu oluşturur (Usta + Lift çakışma kilitli)',
  })
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.createAppointmentUseCase.execute(tenantId, dto, user?.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Randevuyu onaylar (CONFIRMED durumuna alır)' })
  approve(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.updateAppointmentStatusUseCase.approve(tenantId, id, user?.id);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary:
      'Randevu tarih ve saatini yeniden planlar (Usta/Lift çakışma kilitli)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        slotDate: { type: 'string', example: '2026-09-15' },
        slotStartTime: { type: 'string', example: '2026-09-15T09:00:00Z' },
        slotEndTime: { type: 'string', example: '2026-09-15T10:00:00Z' },
        assignedMechanicId: { type: 'string' },
        assignedLift: { type: 'string' },
        reason: { type: 'string', example: 'Yedek parça tedarik süreci' },
        notifyCustomer: { type: 'boolean', example: true },
      },
      required: ['slotDate', 'slotStartTime', 'slotEndTime'],
    },
  })
  reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body()
    dto: {
      slotDate: string;
      slotStartTime: string;
      slotEndTime: string;
      assignedMechanicId?: string;
      assignedLift?: string;
      reason?: string;
      notifyCustomer?: boolean;
    },
  ) {
    return this.rescheduleAppointmentUseCase.execute(
      tenantId,
      id,
      dto,
      user?.id,
    );
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Randevu durumunu günceller' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('status') status: AppointmentStatus,
    @Body('cancellationReason') cancellationReason?: string,
  ) {
    return this.updateAppointmentStatusUseCase.updateStatus(
      tenantId,
      id,
      status,
      cancellationReason,
      user?.id,
    );
  }

  @Patch(':id/no-show')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({
    summary: 'Müşteri randevuya gelmedi (NO_SHOW) olarak işaretler',
  })
  markNoShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.updateAppointmentStatusUseCase.markNoShow(
      tenantId,
      id,
      user?.id,
    );
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary:
      'Randevuyu standart neden belirterek iptal eder (Bağlı iş emri varsa iptal edilir)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          example: 'Müşteri seyahatte olduğunu bildirdi',
        },
      },
    },
  })
  cancelAppointment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.cancelAppointmentUseCase.execute(
      tenantId,
      id,
      reason || 'Belirtilmedi',
      user?.id,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('public/:slug')
  @ApiOperation({
    summary:
      'Dış müşteri randevu formu (Oturumsuz, herkese açık online randevu)',
  })
  createPublic(
    @Param('slug') slug: string,
    @Body() dto: CreatePublicAppointmentDto,
  ) {
    return this.createPublicAppointmentUseCase.execute(slug, dto);
  }
}
