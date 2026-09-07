import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RequirePermission } from '../../shared/decorators/require-permission.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { Permission } from '../../shared/constants/permissions.enum';
import { UserRole } from '@prisma/client';

@ApiTags('Payments & Cashier (Kasa & Tahsilat)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({ summary: 'Tahsilat geçmişini listeler' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.paymentsService.findAll(tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.PAYMENT_CREATE)
  @ApiOperation({ summary: 'Yeni tahsilat alır ve faturayı/cariyi günceller' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false, description: 'Tekrarlanan istek koruması için benzersiz anahtar' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.create(tenantId, dto, user?.name || 'Kasa Görevlisi', user?.id);
  }

  @Get('daily-summary')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({ summary: 'Günlük kasa kapanış ve ödeme yöntemi dağılımını döner' })
  getDailySummary(@CurrentTenant() tenantId: string, @Query('date') date?: string) {
    return this.paymentsService.getDailySummary(tenantId, date);
  }
}
