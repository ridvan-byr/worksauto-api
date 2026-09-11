import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LegalConsentGuard } from './legal-consent.guard';

describe('LegalConsentGuard', () => {
  let guard: LegalConsentGuard;
  let reflector: Reflector;
  let prismaMock: any;

  beforeEach(() => {
    reflector = new Reflector();
    prismaMock = {
      tenant: {
        findUnique: vi.fn(),
      },
    };
    guard = new LegalConsentGuard(reflector, prismaMock);
  });

  const createMockContext = (user: any, isPublic = false, bypassConsent = false): ExecutionContext => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'isPublic') return isPublic;
      if (key === 'bypassB2bConsent') return bypassConsent;
      return false;
    });

    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('1. should allow public routes without checking tenant', async () => {
    const ctx = createMockContext(null, true, false);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('2. should allow routes marked with @BypassB2bConsent()', async () => {
    const ctx = createMockContext({ id: 'u1', tenantId: 't1' }, false, true);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('3. should allow SUPER_ADMIN role unconditionally', async () => {
    const ctx = createMockContext({ id: 'admin1', role: 'SUPER_ADMIN' }, false, false);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(prismaMock.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('4. should block tenant with ForbiddenException if b2bConsentAccepted is false', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 't-unaccepted',
      b2bConsentAccepted: false,
      title: 'İmzasız Servis',
    });

    const ctx = createMockContext(
      { id: 'u-owner', tenantId: 't-unaccepted', role: 'OWNER' },
      false,
      false,
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 't-unaccepted' },
      select: { id: true, b2bConsentAccepted: true, title: true },
    });
  });

  it('5. should allow tenant if b2bConsentAccepted is true', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 't-accepted',
      b2bConsentAccepted: true,
      title: 'Yasal Onaylı Servis',
    });

    const ctx = createMockContext(
      { id: 'u-owner', tenantId: 't-accepted', role: 'OWNER' },
      false,
      false,
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
