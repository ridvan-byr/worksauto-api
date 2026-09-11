import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import {
  CreateWorkshopBayDto,
  UpdateWorkshopBayDto,
} from './dto/workshop-bays.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
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
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.CASHIER,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Giriş yapan servisin profil ve ayar bilgilerini getirir',
  })
  getCurrent(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getCurrent(tenantId);
  }

  @Patch('current')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Servis bilgilerini, adresini ve vergi kayıtlarını günceller',
  })
  updateCurrent(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateCurrent(tenantId, dto);
  }

  @Post('onboarding')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Atölye kurulum sihirbazını (çalışma saatleri, liftler, başlangıç servisleri) tamamlar',
  })
  completeOnboarding(
    @CurrentTenant() tenantId: string,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.tenantsService.completeOnboarding(tenantId, dto);
  }

  @Get('bays')
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.TECHNICIAN,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary: 'Servisin atölye istasyonları ve lift listesini getirir',
  })
  getBays(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getBays(tenantId);
  }

  @Post('bays')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni atölye istasyonu veya lift ekler' })
  createBay(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWorkshopBayDto,
  ) {
    return this.tenantsService.createBay(tenantId, dto);
  }

  @Patch('bays/:id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Atölye istasyonu veya lift bilgilerini günceller' })
  updateBay(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkshopBayDto,
  ) {
    return this.tenantsService.updateBay(tenantId, id, dto);
  }

  @Delete('bays/:id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Atölye istasyonunu veya lifti siler' })
  deleteBay(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.tenantsService.deleteBay(tenantId, id);
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({
    summary:
      'Müşteri randevu sayfası için servis profili ve hizmet kataloğunu döner',
  })
  getBySlugPublic(@Param('slug') slug: string) {
    return this.tenantsService.getBySlugPublic(slug);
  }

  @Get('notification-settings')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary: 'İşletmenin çok kanallı bildirim ve iletişim tercihlerini getirir',
  })
  getNotificationSettings(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getNotificationSettings(tenantId);
  }

  @Patch('notification-settings')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'İşletmenin kanal önceliği ve strateji ayarlarını günceller',
  })
  updateNotificationSettings(
    @CurrentTenant() tenantId: string,
    @Body() dto: import('./dto/update-notification-settings.dto').UpdateNotificationSettingsDto,
  ) {
    return this.tenantsService.updateNotificationSettings(tenantId, dto);
  }
}
