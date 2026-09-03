import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WorkOrdersService, CreateWorkOrderDto } from './work-orders.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, WorkOrderStatus, WorkOrderPhotoType } from '@prisma/client';

@ApiTags('Work Orders (Atölye İş Emirleri)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'İş emirlerini durumuna göre listeler' })
  findAll(@CurrentTenant() tenantId: string, @Query('status') status?: WorkOrderStatus) {
    return this.workOrdersService.findAll(tenantId, status);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'İş emri detayını, kalemlerini ve fotoğraflarını döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workOrdersService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni iş emri açar ve parçaları atomik olarak stoktan düşer' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.workOrdersService.create(tenantId, dto, userName || 'Servis Danışmanı');
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emri aşamasını ilerletir (QUEUE -> IN_PROGRESS -> COMPLETED)' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('status') status: WorkOrderStatus,
  ) {
    return this.workOrdersService.updateStatus(tenantId, id, status);
  }

  @Post(':id/rollback')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'İş emrini güvenle bir önceki aşamaya geri alır' })
  rollback(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workOrdersService.rollbackStatus(tenantId, id);
  }

  @Post(':id/photos')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emrine fotoğraf ekler' })
  addPhoto(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('url') url: string,
    @Body('caption') caption: string,
    @Body('photoType') photoType: WorkOrderPhotoType,
    @CurrentUser('name') userName: string,
  ) {
    return this.workOrdersService.addPhoto(tenantId, id, url, caption, photoType || WorkOrderPhotoType.CHECKIN, userName || 'Personel');
  }
}
