import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { VehiclesService, CreateVehicleDto } from './vehicles.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Vehicles (Araçlar)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Araçları listeler veya plakaya göre arar' })
  findAll(@CurrentTenant() tenantId: string, @Query('search') search?: string) {
    return this.vehiclesService.findAll(tenantId, search);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Araç detayını ve servis geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.vehiclesService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni araç kaydı oluşturur' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(tenantId, dto);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Araç bilgilerini veya kilometresini günceller' })
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: Partial<CreateVehicleDto>) {
    return this.vehiclesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Aracı arşivler (Soft Delete)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.vehiclesService.softDelete(tenantId, id);
  }
}
