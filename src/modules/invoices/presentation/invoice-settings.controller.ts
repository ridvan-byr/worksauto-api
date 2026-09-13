import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { InvoiceSettingsService } from '../application/invoice-settings.service';
import {
  UpdateInvoiceSettingsDto,
  TestInvoiceConnectionDto,
} from '../dto/invoice-settings.dto';

@ApiTags('Invoices & E-Invoice Settings (E-Fatura Entegrasyon Ayarları)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('settings/invoice')
export class InvoiceSettingsController {
  constructor(
    private readonly invoiceSettingsService: InvoiceSettingsService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Servisin e-fatura sağlayıcı ayarlarını getirir' })
  getSettings(@CurrentTenant() tenantId: string) {
    return this.invoiceSettingsService.getSettings(tenantId);
  }

  @Put()
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Servisin e-fatura sağlayıcı ve API anahtarlarını günceller',
  })
  updateSettings(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateInvoiceSettingsDto,
  ) {
    return this.invoiceSettingsService.updateSettings(tenantId, dto);
  }

  @Post('test')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary:
      'Girilen sağlayıcı kimlik bilgileriyle canlı bağlantı ve bakiye testi yapar',
  })
  testConnection(
    @CurrentTenant() tenantId: string,
    @Body() dto: TestInvoiceConnectionDto,
  ) {
    return this.invoiceSettingsService.testConnection(tenantId, dto);
  }

  @Get('check-tax/:taxNumber')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({
    summary: 'Müşteri VKN/TCKN sorgulayarak E-Fatura mı E-Arşiv mi olduğunu tespit eder',
  })
  checkTaxType(
    @CurrentTenant() tenantId: string,
    @Param('taxNumber') taxNumber: string,
  ) {
    return this.invoiceSettingsService.checkCustomerTaxType(tenantId, taxNumber);
  }
}
