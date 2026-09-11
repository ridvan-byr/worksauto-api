import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateCustomerDto,
  QuickLeadDto,
  BatchImportRequestDto,
} from '../dto/customer.dto';
import { DirectConsentDto } from '../dto/consent.dto';
import { GetCustomersUseCase } from '../application/use-cases/get-customers.use-case';
import { CreateCustomerUseCase } from '../application/use-cases/create-customer.use-case';
import { UpdateCustomerUseCase } from '../application/use-cases/update-customer.use-case';
import { QuickLeadUseCase } from '../application/use-cases/quick-lead.use-case';
import { BatchImportCustomersUseCase } from '../application/use-cases/batch-import-customers.use-case';
import { AnonymizeCustomerUseCase } from '../application/use-cases/anonymize-customer.use-case';
import { ManageConsentUseCase } from '../application/use-cases/manage-consent.use-case';

@ApiTags('Customers (Müşteriler)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly getCustomersUseCase: GetCustomersUseCase,
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly quickLeadUseCase: QuickLeadUseCase,
    private readonly batchImportCustomersUseCase: BatchImportCustomersUseCase,
    private readonly anonymizeCustomerUseCase: AnonymizeCustomerUseCase,
    private readonly manageConsentUseCase: ManageConsentUseCase,
  ) {}

  @Get()
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.CASHIER,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({ summary: 'Tenant altındaki müşterileri listeler veya arar' })
  findAll(@CurrentTenant() tenantId: string, @Query('search') search?: string) {
    return this.getCustomersUseCase.execute(tenantId, search);
  }

  @Get(':id/stats')
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.TECHNICIAN,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary:
      'Müşterinin randevu karnesi, güvenilirlik ve no-show istatistiklerini döner',
  })
  getStats(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getCustomersUseCase.getStats(tenantId, id);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Müşteri detayını ve geçmiş iş emirlerini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getCustomersUseCase.getById(tenantId, id);
  }

  @Post('batch-import')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary: 'Excel veya tablodan toplu müşteri ve araç kaydı aktarır',
  })
  batchImport(
    @CurrentTenant() tenantId: string,
    @Body() body: BatchImportRequestDto,
  ) {
    return this.batchImportCustomersUseCase.execute(
      tenantId,
      body?.items || [],
      {
        updateExisting: Boolean(body?.updateExisting),
      },
    );
  }

  @Post('quick-lead')
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.TECHNICIAN,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary:
      'Randevu esnasında tek adımda hızlı potansiyel müşteri ve araç oluşturur',
  })
  quickLead(@CurrentTenant() tenantId: string, @Body() dto: QuickLeadDto) {
    return this.quickLeadUseCase.execute(tenantId, dto);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni müşteri kaydı ve cari hesap açar' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateCustomerDto) {
    return this.createCustomerUseCase.execute(tenantId, dto);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Müşteri bilgilerini günceller' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCustomerDto>,
  ) {
    return this.updateCustomerUseCase.execute(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Müşteriyi arşivler (Soft Delete)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getCustomersUseCase.softDelete(tenantId, id);
  }

  @Post(':id/anonymize')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'KVKK Unutulma Hakkı: Müşteri verilerini hash-chaining ile anonimleştirir',
  })
  anonymize(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @Body('legalRef') legalRef: string,
  ) {
    return this.anonymizeCustomerUseCase.execute(
      tenantId,
      id,
      userId,
      legalRef || 'KVKK_TALEP_FORMU',
    );
  }

  @Get(':id/consents')
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.CASHIER,
    UserRole.TECHNICIAN,
  )
  @ApiOperation({
    summary: 'Müşterinin KVKK ve ticari SMS onay durumunu ve tarihçesini döner',
  })
  getConsents(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.manageConsentUseCase.getConsents(tenantId, id);
  }

  @Post(':id/send-consent-sms')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({
    summary:
      'Müşteriye KVKK ve İYS dijital onay bağlantısı üretir ve SMS gönderir',
  })
  sendConsentSms(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.manageConsentUseCase.sendConsentSms(tenantId, id);
  }

  @Post(':id/direct-consent')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.CASHIER)
  @ApiOperation({
    summary: 'Fiziksel form veya tezgah üstü onayını doğrudan işler',
  })
  recordDirectConsent(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: DirectConsentDto,
    @Req() req: any,
  ) {
    const rawIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const clientIp = rawIp.startsWith('::ffff:')
      ? rawIp.replace('::ffff:', '')
      : rawIp;
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    return this.manageConsentUseCase.recordDirectConsent(
      tenantId,
      id,
      dto,
      clientIp,
      userAgent,
    );
  }
}
