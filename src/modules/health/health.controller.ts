import {
  Controller,
  Get,
  HttpStatus,
  Res,
  Headers,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import * as crypto from 'crypto';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';

/**
 * Constant-time comparison preventing timing attacks on static tokens.
 */
function timingSafeCompare(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const bufProvided = Buffer.from(provided);
  const bufExpected = Buffer.from(expected);
  if (bufProvided.length !== bufExpected.length) return false;
  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

@ApiTags('Health & Monitoring')
@SkipThrottle() // Uptime robotları ve Caddy probe'larının rate limit'e (429) takılmasını önler
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Public Liveness Probe
   * Uptime robotları, load balancer ve Caddy için sade ve sızıntısız sağlık kontrolü.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Public liveness probe (Load balancer / Caddy)' })
  @ApiResponse({ status: 200, description: 'Servis ayakta ve yanıt veriyor.' })
  checkLive() {
    return { status: 'ok' };
  }

  /**
   * Korumalı ve Detaylı Sağlık Denetimi
   * Yalnızca SUPER_ADMIN rolü veya güvenli X-Health-Token ile erişilebilir.
   * Fail-Closed: HEALTH_TOKEN tanımlı değilse token tabanlı erişim tamamen kapalıdır.
   */
  @Public()
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

    const checks: Record<string, any> = {};
    let isHealthy = true;

    // 1. PostgreSQL Latency Check
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'up',
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: any) {
      isHealthy = false;
      checks.database = {
        status: 'down',
        error: err.message,
        latencyMs: Date.now() - dbStart,
      };
    }

    // 2. Redis Latency Check
    const redisStart = Date.now();
    try {
      const pingRes = await this.redis.ping();
      checks.redis = {
        status: pingRes === 'PONG' ? 'up' : 'degraded',
        latencyMs: Date.now() - redisStart,
      };
    } catch (err: any) {
      isHealthy = false;
      checks.redis = {
        status: 'down',
        error: err.message,
        latencyMs: Date.now() - redisStart,
      };
    }

    // 3. Node.js Memory & Uptime
    const memory = process.memoryUsage();
    checks.process = {
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    };

    const result = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
