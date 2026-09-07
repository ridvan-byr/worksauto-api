import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: Record<string, any>;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async checkDetail(): Promise<{ isHealthy: boolean; result: HealthCheckResult }> {
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

    const result: HealthCheckResult = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };

    return { isHealthy, result };
  }
}
