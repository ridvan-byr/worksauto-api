import { describe, expect, it, vi } from 'vitest';
import { validateAccessIdentity } from './access-identity';

describe('access identity validation', () => {
  const payload = {
    sub: 'user',
    tenantId: 'tenant',
    role: 'OWNER',
    tokenType: 'access',
    familyId: 'session',
  };
  const mock = () => ({
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user',
        isActive: true,
        role: 'OWNER',
        tenantId: 'tenant',
        tenant: { isActive: true },
      }),
    },
    refreshToken: { findFirst: vi.fn().mockResolvedValue({ id: 'refresh' }) },
  });
  it('rejects refresh credentials without querying privileged data', async () => {
    const db = mock();
    await expect(
      validateAccessIdentity(db as any, { ...payload, tokenType: 'refresh' }),
    ).rejects.toThrow('access token');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('rejects revoked sessions and disabled users', async () => {
    const db = mock();
    db.refreshToken.findFirst.mockResolvedValue(null);
    await expect(validateAccessIdentity(db as any, payload)).rejects.toThrow(
      'revoked',
    );
    db.user.findUnique.mockResolvedValue({ isActive: false } as any);
    await expect(validateAccessIdentity(db as any, payload)).rejects.toThrow(
      'no longer active',
    );
  });
  it('rejects stale roles and accepts an active session', async () => {
    const db = mock();
    await expect(
      validateAccessIdentity(db as any, payload),
    ).resolves.toMatchObject({ id: 'user' });
    await expect(
      validateAccessIdentity(db as any, { ...payload, role: 'CASHIER' }),
    ).rejects.toThrow('no longer active');
  });
});
