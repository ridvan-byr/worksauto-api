import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Tenants & Settings (Servis & Dükkan Ayarları)')
@ApiBearerAuth('JWT-auth')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Giriş yapan servisin profil ve ayar bilgilerini getirir' })
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getCurrent(tenantId);
  }

  @Patch('current')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Servis bilgilerini, adresini ve vergi kayıtlarını günceller' })
  updateCurrent(@CurrentTenant() tenantId: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateCurrent(tenantId, dto);
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({ summary: 'Müşteri randevu sayfası için servis profili ve hizmet kataloğunu döner' })
  getBySlugPublic(@Param('slug') slug: string) {
    return this.tenantsService.getBySlugPublic(slug);
  }
}
