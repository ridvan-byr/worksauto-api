import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../shared/decorators/public.decorator';
import { ManageConsentUseCase } from '../application/use-cases/manage-consent.use-case';
import { ConfirmConsentDto } from '../dto/consent.dto';

@ApiTags('Public Consent (KVKK & İYS Müşteri Onay Sayfası)')
@Controller('public/consent')
export class ConsentPublicController {
  constructor(private readonly manageConsentUseCase: ManageConsentUseCase) {}

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Get('verify/:token')
  @ApiOperation({
    summary:
      'Müşteriye SMS ile giden onay tokenını doğrular ve servis metnini getirir',
  })
  verifyToken(@Param('token') token: string) {
    return this.manageConsentUseCase.verifyToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('confirm/:token')
  @ApiOperation({
    summary: 'Müşteri açık rıza ve KVKK onayını IP/cihaz bilgisiyle kaydeder',
  })
  confirm(
    @Param('token') token: string,
    @Body() dto: ConfirmConsentDto,
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

    return this.manageConsentUseCase.confirmConsent(
      token,
      dto,
      clientIp,
      userAgent,
    );
  }
}
