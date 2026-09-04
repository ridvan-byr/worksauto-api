import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Staff & Mechanics (Personel & Usta Yönetimi)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Servisteki tüm personelleri ve usta/lift profillerini listeler' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.staffService.findAll(tenantId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Personel detayını getirir' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.staffService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni personel / usta kaydı açar ve lift ataması yapar' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateStaffDto) {
    return this.staffService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Personel bilgilerini, uzmanlığını veya atanmış liftini günceller' })
  update(@CurrentTenant() tenantId: string, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Personeli pasife alır (Soft Delete / İşten Çıkarma)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.staffService.remove(tenantId, id);
  }
}
