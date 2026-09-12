import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService, CreatePaymentDto } from './payments.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RequirePermission } from '../../shared/decorators/require-permission.decorator';
import { RequireIdempotency } from '../../shared/decorators/require-idempotency.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { Permission } from '../../shared/constants/permissions.enum';
import { Public } from '../../shared/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { CreatePayTrTokenDto } from './dto/create-paytr-token.dto';
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
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.findAll(tenantId, page, limit);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.PAYMENT_CREATE)
  @RequireIdempotency()
  @ApiOperation({ summary: 'Yeni tahsilat alır ve faturayı/cariyi günceller' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: true,
    description: 'Tekrarlanan istek koruması için benzersiz anahtar',
  })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.create(
      tenantId,
      dto,
      user?.name || 'Kasa Görevlisi',
      user?.id,
    );
  }

  @Get('daily-summary')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.PAYMENT_VIEW)
  @ApiOperation({
    summary: 'Günlük kasa kapanış ve ödeme yöntemi dağılımını döner',
  })
  getDailySummary(
    @CurrentTenant() tenantId: string,
    @Query('date') date?: string,
  ) {
    return this.paymentsService.getDailySummary(tenantId, date);
  }

  @Public()
  @Post('webhook/paytr')
  @ApiOperation({
    summary: 'PayTR Webhook Callback (İmza doğrulamalı ödeme bildirimi)',
  })
  handlePayTrWebhook(@Body() payload: any) {
    return this.paymentsService.handlePayTrWebhook(payload);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('public/create-paytr-token')
  @ApiOperation({
    summary: 'Müşteri için PayTR ödeme tokenı üretir (Şifresiz / Linkle Ödeme)',
  })
  createPayTrToken(@Body() dto: CreatePayTrTokenDto, @Req() req: any) {
    const rawIp =
      req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
    return this.paymentsService.createPayTrPaymentToken(dto.invoiceId, ip);
  }
}
