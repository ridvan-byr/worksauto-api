import {
  Controller,
  Get,
  HttpStatus,
  Res,
  Headers,
  UnauthorizedException,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as crypto from 'crypto';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { HealthService } from './health.service';

/**
 * SHA-256 Hash bazlı sabit zamanlı karşılaştırma.
 * Her iki girdi de 32-byte sabit uzunluklu özete (digest) dönüştürülür:
 * 1. timingSafeEqual asla buffer uzunluk hatası (RangeError) fırlatmaz.
 * 2. Uzunluk farkından doğan zamanlama sızıntısı (length side-channel) %100 engellenir.
 */
function timingSafeCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Public Liveness Probe
   * Uptime robotları, load balancer ve Caddy için sade ve sızıntısız sağlık kontrolü.
   * @SkipThrottle: 10-30s aralıklarla yapılan periyodik probe'ların 429 sahte alarmı üretmesi önlenir.
   */
  @Public()
  @SkipThrottle()
  @Get('live')
  @ApiOperation({ summary: 'Public liveness probe (Load balancer / Caddy)' })
  @ApiResponse({ status: 200, description: 'Servis ayakta ve yanıt veriyor.' })
  checkLive() {
    return { status: 'ok' };
  }

  /**
   * Korumalı ve Detaylı Sağlık Denetimi
   * Yalnızca SUPER_ADMIN rolü veya güvenli X-Health-Token ile erişilebilir.
   * OptionalJwtAuthGuard ile Bearer veya cookie JWT varsa request.user doldurulur.
   * Fail-Closed: HEALTH_TOKEN tanımlı değilse token tabanlı erişim tamamen kapalıdır.
   * Defense-in-Depth Throttle: Brute-force saldırılarını önlemek için sıkı rate limit (dakikada 20 istek).
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('detail')
  @ApiOperation({ summary: 'Korumalı detaylı sistem sağlık ve gecikme metrikleri' })
  @ApiResponse({ status: 200, description: 'Tüm alt sistemler operasyonel.' })
  @ApiResponse({ status: 503, description: 'Bir veya daha fazla alt sistem yanıt vermiyor.' })
  async checkDetail(
    @Headers('x-health-token') healthToken: string,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const configuredToken = process.env.HEALTH_TOKEN;

    // Fail-closed token doğrulaması: HEALTH_TOKEN tanımlı değilse token ile erişim imkansızdır
    const isTokenValid = Boolean(
      configuredToken &&
      configuredToken.trim().length >= 16 &&
      healthToken &&
      timingSafeCompare(healthToken, configuredToken)
    );

    const isSuperAdmin = Boolean(user && user.role === 'SUPER_ADMIN');

    // Yetkisiz erişim durumunda detay sızdırmadan fail-closed durdur
    if (!isTokenValid && !isSuperAdmin) {
      throw new UnauthorizedException('Detaylı sistem sağlığı kontrolü için yetkiniz bulunmamaktadır.');
    }

    const { isHealthy, result } = await this.healthService.checkDetail();

    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
