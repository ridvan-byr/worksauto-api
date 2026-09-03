import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentAccountsService } from './current-accounts.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Current Accounts (Cari Hesaplar & Ekstre)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('current-accounts')
export class CurrentAccountsController {
  constructor(private readonly currentAccountsService: CurrentAccountsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Müşteri cari bakiye listesini döner' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.currentAccountsService.findAll(tenantId);
  }

  @Get('customer/:customerId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Müşterinin detaylı cari hesap hareketlerini (ekstre) döner' })
  findByCustomerId(@CurrentTenant() tenantId: string, @Param('customerId') customerId: string) {
    return this.currentAccountsService.findByCustomerId(tenantId, customerId);
  }
}
