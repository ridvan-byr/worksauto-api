import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminTenantService } from './admin-tenant.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminTenantService', () => {
  let service: AdminTenantService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      branch: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(),
    };

    service = new AdminTenantService(mockPrisma as PrismaService);
  });

  it('should list tenants with filters', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([
      {
        id: 't-1',
        slug: 'oto-servis',
        title: 'Oto Servis',
        phone: '0532',
        email: 'info@oto.com',
        city: 'İstanbul',
        isActive: true,
        createdAt: new Date(),
        _count: { users: 3, workOrders: 10, vehicles: 5, customers: 8 },
        users: [{ name: 'Ali', surname: 'Usta', phone: '0532', email: 'ali@oto.com' }],
      },
    ]);

    const result = await service.getTenants({ status: 'ACTIVE' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Oto Servis');
    expect(result[0].owner).toBe('Ali Usta');
  });

  it('should throw NotFoundException on non-existing tenant detail', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.getTenantDetail('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should update tenant status', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't-1', title: 'Oto Servis', isActive: false });
    mockPrisma.tenant.update.mockResolvedValue({ id: 't-1', title: 'Oto Servis', isActive: true });

    const result = await service.updateTenantStatus('t-1', { isActive: true });
    expect(result.success).toBe(true);
    expect(result.tenant.isActive).toBe(true);
  });
});
