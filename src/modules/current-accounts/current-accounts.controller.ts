import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { GetCurrentAccountsUseCase } from './application/use-cases/get-current-accounts.use-case';
import { GetCustomerCurrentAccountUseCase } from './application/use-cases/get-customer-current-account.use-case';
import { UpdateCreditLimitUseCase } from './application/use-cases/update-credit-limit.use-case';
import { UpdateCreditLimitDto } from './dto/update-credit-limit.dto';

@ApiTags('Current Accounts (Cari Hesaplar & Ekstre)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('current-accounts')
export class CurrentAccountsController {
  constructor(
    private readonly getCurrentAccountsUseCase: GetCurrentAccountsUseCase,
    private readonly getCustomerCurrentAccountUseCase: GetCustomerCurrentAccountUseCase,
    private readonly updateCreditLimitUseCase: UpdateCreditLimitUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Müşteri cari bakiye listesini döner' })
  findAll(@CurrentTenant() tenantId: string) {
    return this.getCurrentAccountsUseCase.execute(tenantId);
  }

  @Get('customer/:customerId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({
    summary: 'Müşterinin detaylı cari hesap hareketlerini (ekstre) döner',
  })
  findByCustomerId(
    @CurrentTenant() tenantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.getCustomerCurrentAccountUseCase.execute(tenantId, customerId);
  }

  @Patch('customer/:customerId/limit')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary: 'Müşteri kredi limitini ve bloke durumunu günceller',
  })
  updateLimit(
    @CurrentTenant() tenantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCreditLimitDto,
  ) {
    return this.updateCreditLimitUseCase.execute(
      tenantId,
      customerId,
      dto.creditLimit,
      dto.isBlocked,
    );
  }
}
