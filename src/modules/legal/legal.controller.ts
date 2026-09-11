import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { LegalService } from './legal.service';
import { SignB2bConsentDto } from './dto/sign-b2b-consent.dto';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { BypassB2bConsent } from '../../shared/decorators/bypass-b2b-consent.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('B2B Legal & KVKK (Super Admin <-> İşletme Sözleşmeleri)')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get('contract-details')
  @ApiOperation({
    summary: 'Güncel B2B SaaS ve KVKK sözleşme metnini ve versiyonunu döner',
  })
  getContractDetails() {
    return this.legalService.getContractDetails();
  }

  @BypassB2bConsent()
  @ApiBearerAuth('JWT-auth')
  @Get('status')
  @ApiOperation({
    summary:
      'Giriş yapan işletmenin B2B sözleşme onay durumunu ve son imza kaydını döner',
  })
  getStatus(@CurrentTenant() tenantId: string) {
    return this.legalService.getTenantConsentStatus(tenantId);
  }

  @Patch('marketing-consent')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary:
      'İşletmenin 6563 sayılı Kanun kapsamındaki ticari elektronik ileti iznini günceller veya iptal eder (Ret hakkı)',
  })
  updateMarketingConsent(
    @CurrentTenant() tenantId: string,
    @Body('marketingAccepted') marketingAccepted: boolean,
  ) {
    return this.legalService.updateMarketingConsent(tenantId, !!marketingAccepted);
  }

  @Public()
  @Post('opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'SMS veya E-Posta içerisindeki ret bağlantısıyla şifresiz ticari ileti iznini iptal eder (6563 ETK)',
  })
  publicOptOutPost(
    @Body('identifier') identifier: string,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Public Opt-Out Client';

    return this.legalService.processPublicOptOut(identifier, { ip, userAgent });
  }

  @BypassB2bConsent()
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'İşletme yetkilisi olarak B2B SaaS Sözleşmesi ve KVKK Protokolünü onaylar (Sert Kapı Kilidini Kaldırır)',
  })
  signConsent(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SignB2bConsentDto,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Client';

    return this.legalService.signB2bConsent(tenantId, userId, dto, {
      ip,
      userAgent,
    });
  }
}
