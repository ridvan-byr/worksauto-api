import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Payments & Cashier (Kasa & Tahsilat)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Tahsilat geçmişini listeler' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.paymentsService.findAll(tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Yeni tahsilat alır ve faturayı/cariyi günceller' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.paymentsService.create(tenantId, dto, userName || 'Kasa Görevlisi');
  }

  @Get('daily-summary')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Günlük kasa kapanış ve ödeme yöntemi dağılımını döner' })
  getDailySummary(@CurrentTenant() tenantId: string, @Query('date') date?: string) {
    return this.paymentsService.getDailySummary(tenantId, date);
  }
}
