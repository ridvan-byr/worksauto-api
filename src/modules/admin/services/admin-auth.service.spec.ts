import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminAuthService } from './admin-auth.service';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let mockPrisma: any;
  let mockJwt: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    mockJwt = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
    };

    service = new AdminAuthService(mockPrisma as PrismaService, mockJwt as JwtService);
  });

  it('should throw UnauthorizedException if user not found or not SUPER_ADMIN', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'fake@admin.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if password is invalid', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@worksauto.com',
      role: UserRole.SUPER_ADMIN,
      passwordHash: await bcrypt.hash('correctpassword', 10),
      isActive: true,
    });

    await expect(
      service.login({ email: 'admin@worksauto.com', password: 'wrongpassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should return token and user on successful login', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'admin-1',
      name: 'Super',
      surname: 'Admin',
      email: 'admin@worksauto.com',
      phone: '05551112233',
      role: UserRole.SUPER_ADMIN,
      passwordHash,
      isActive: true,
    });

    const result = await service.login({ email: 'admin@worksauto.com', password: 'secret123' });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.user.email).toBe('admin@worksauto.com');
  });
});
