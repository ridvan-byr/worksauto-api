import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InvoicesService, CreateInvoiceDto } from './invoices.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';

@ApiTags('Invoices (Faturalar & E-Fatura)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Faturaları listeler veya duruma göre filtreler' })
  findAll(@CurrentTenant() tenantId: string, @Query('status') status?: InvoiceStatus) {
    return this.invoicesService.findAll(tenantId, status);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Fatura detayını ve tahsilat geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni fatura keser ve cari hesaba borç işler' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(tenantId, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Faturayı yasal olarak iptal eder (VUK İptal Kaydı)' })
  cancel(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.invoicesService.cancelInvoice(tenantId, id, reason || 'Müşteri talebi / Hatalı giriş');
  }
}
