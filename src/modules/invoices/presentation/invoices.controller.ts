import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { RequirePermission } from '../../../shared/decorators/require-permission.decorator';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { IdempotencyInterceptor } from '../../../shared/interceptors/idempotency.interceptor';
import { Permission } from '../../../shared/constants/permissions.enum';
import { UserRole, InvoiceStatus } from '@prisma/client';

import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { GetInvoicesUseCase } from '../application/use-cases/get-invoices.use-case';
import { CreateInvoiceUseCase } from '../application/use-cases/create-invoice.use-case';
import { CancelInvoiceUseCase } from '../application/use-cases/cancel-invoice.use-case';

@ApiTags('Invoices (Faturalar & E-Fatura)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly getInvoicesUseCase: GetInvoicesUseCase,
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly cancelInvoiceUseCase: CancelInvoiceUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.INVOICE_VIEW)
  @ApiOperation({ summary: 'Faturaları listeler veya duruma göre filtreler' })
  findAll(@CurrentTenant() tenantId: string, @Query('status') status?: InvoiceStatus) {
    return this.getInvoicesUseCase.execute(tenantId, status);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @RequirePermission(Permission.INVOICE_VIEW)
  @ApiOperation({ summary: 'Fatura detayını ve tahsilat geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getInvoicesUseCase.getById(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @RequirePermission(Permission.INVOICE_CREATE)
  @ApiOperation({ summary: 'Yeni fatura keser ve cari hesaba borç işler' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false, description: 'Tekrarlanan istek koruması için benzersiz anahtar' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.createInvoiceUseCase.execute(tenantId, dto, userId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @RequirePermission(Permission.INVOICE_CANCEL)
  @ApiOperation({ summary: 'Faturayı yasal olarak iptal eder (VUK İptal Kaydı)' })
  cancel(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.cancelInvoiceUseCase.execute(
      tenantId,
      id,
      reason || 'Müşteri talebi / Hatalı giriş',
      userId,
    );
  }
}
