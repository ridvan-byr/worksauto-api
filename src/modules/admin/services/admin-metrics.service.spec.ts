import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminMetricsService } from './admin-metrics.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../../shared/infrastructure/redis/redis.service';

describe('AdminMetricsService', () => {
  let service: AdminMetricsService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        count: vi.fn().mockResolvedValue(10),
      },
      workOrder: {
        count: vi.fn().mockResolvedValue(50),
        aggregate: vi.fn().mockResolvedValue({ _sum: { grandTotal: 150000 } }),
      },
      customer: {
        count: vi.fn().mockResolvedValue(100),
      },
      user: {
        count: vi.fn().mockResolvedValue(15),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue('ok'),
      set: vi.fn().mockResolvedValue(undefined),
    };

    service = new AdminMetricsService(mockPrisma as PrismaService, mockRedis as RedisService);
  });

  it('should return SaaS KPI stats', async () => {
    const stats = await service.getStats();
    expect(stats.totalTenants).toBe(10);
    expect(stats.totalPlatformVolume).toBe(150000);
  });

  it('should report OPERATIONAL system health when DB and Redis are healthy', async () => {
    const health = await service.getSystemHealth();
    expect(health.status).toBe('OPERATIONAL');
    expect(health.database.status).toBe('HEALTHY');
    expect(health.redis.status).toBe('HEALTHY');
  });

  it('should report DEGRADED system health when Redis is down', async () => {
    mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));

    const health = await service.getSystemHealth();
    expect(health.status).toBe('DEGRADED');
    expect(health.redis.status).toBe('DOWN');
  });
});
