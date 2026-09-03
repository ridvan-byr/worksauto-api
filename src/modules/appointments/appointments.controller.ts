import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentsService, CreateAppointmentDto } from './appointments.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
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
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(tenantId, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Randevu durumunu günceller (Onayla, İptal, Atölyeye Al)' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: AppointmentStatus,
    @Body('cancellationReason') cancellationReason?: string,
  ) {
    return this.appointmentsService.updateStatus(tenantId, id, status, cancellationReason);
  }
}
