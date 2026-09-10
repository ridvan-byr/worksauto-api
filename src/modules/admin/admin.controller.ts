import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminTenantService } from './services/admin-tenant.service';
import { AdminMetricsService } from './services/admin-metrics.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Admin (Super Admin Platform Control Plane)')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminTenantService: AdminTenantService,
    private readonly adminMetricsService: AdminMetricsService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/login')
  @ApiOperation({ summary: 'Super Admin E-Posta & Şifre ile platform girişi (IP & UserAgent loglu)' })
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const clientIp = rawIp.startsWith('::ffff:') ? rawIp.replace('::ffff:', '') : rawIp;
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    const result = await this.adminAuthService.login(dto, clientIp, userAgent);

    // 1 saat ömürlü, httpOnly, path:/api/v1/admin ile kısıtlı güvenli çerez
    res.cookie('adminAccessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600 * 1000,
      path: '/api/v1/admin',
    });

    return {
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('auth/logout')
  @ApiOperation({ summary: 'Super Admin oturumunu güvenle kapatır ve cookie temizler' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('adminAccessToken', { path: '/api/v1/admin' });
    return { success: true, message: 'Yönetici oturumu başarıyla kapatıldı.' };
  }

  @Get('stats')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform geneli SaaS özet metrikleri' })
  getStats() {
    return this.adminMetricsService.getStats();
  }

  @Get('tenants')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Tüm servis kiracılarını filtreli listeler' })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'ACTIVE', 'INACTIVE'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'city', required: false })
  getTenants(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
  ) {
    return this.adminTenantService.getTenants({ status, search, city });
  }

  @Post('tenants')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yeni bir servis kiracısı (Tenant) ve kurucu yetkili hesabı açar' })
  createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: any,
  ) {
    return this.adminTenantService.createTenant(dto, user?.id);
  }

  @Delete('tenants/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bir servisi ve bağlı tüm operasyonel verilerini kalıcı olarak siler' })
  deleteTenant(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.adminTenantService.deleteTenant(id, user?.id);
  }

  @Get('tenants/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Belirli bir servisin detaylı verilerini getirir' })
  getTenantDetail(@Param('id') id: string) {
    return this.adminTenantService.getTenantDetail(id);
  }

  @Patch('tenants/:id/status')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Servis lisans durumunu günceller (Onayla / Dondur)' })
  updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.adminTenantService.updateTenantStatus(id, dto, user?.id);
  }

  @Get('audit-logs')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform geneli güvenlik ve kritik işlem logları (sayfalama destekli)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('search') search?: string,
  ) {
    return this.adminMetricsService.getAuditLogs({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      action,
      search,
    });
  }

  @Get('health')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'PostgreSQL ve Redis sistem sağlık durumu' })
  getSystemHealth() {
    return this.adminMetricsService.getSystemHealth();
  }
}
