import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentsService, CreateAppointmentDto } from './appointments.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, AppointmentStatus } from '@prisma/client';

@ApiTags('Appointments (Randevu Takvimi)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Tarihe göre randevuları listeler' })
  findAll(@CurrentTenant() tenantId: string, @Query('date') date?: string) {
    return this.appointmentsService.findAll(tenantId, date);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Randevu detayını getirir' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.appointmentsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni randevu oluşturur (Usta + Lift çakışma kilitli)' })
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(tenantId, dto, user?.id);
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
    return this.appointmentsService.updateStatus(tenantId, id, status, cancellationReason, user?.id);
  }

  @Patch(':id/no-show')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Müşteri randevuya gelmedi (NO_SHOW) olarak işaretler' })
  markNoShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.markNoShow(tenantId, id, user?.id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Randevuyu standart neden belirterek iptal eder (Bağlı iş emri varsa iptal edilir)' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string', example: 'Müşteri seyahatte olduğunu bildirdi' } } } })
  cancelAppointment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.appointmentsService.cancelAppointment(tenantId, id, reason || 'Belirtilmedi', user?.id);
  }
}
