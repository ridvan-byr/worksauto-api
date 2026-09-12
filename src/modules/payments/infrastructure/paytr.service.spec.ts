import { describe, it, expect, beforeEach } from 'vitest';
import { PayTrService } from './paytr.service';
import { ConfigService } from '@nestjs/config';

describe('PayTrService', () => {
  let service: PayTrService;
  let mockConfig: Partial<ConfigService>;

  beforeEach(() => {
    mockConfig = {
      get: (key: string) => {
        if (key === 'PAYTR_MERCHANT_ID') return '123456';
        if (key === 'PAYTR_MERCHANT_KEY') return 'test_secret_key_123';
        if (key === 'PAYTR_MERCHANT_SALT') return 'test_salt_456';
        if (key === 'PAYTR_TEST_MODE') return '1';
        return null;
      },
    };

    service = new PayTrService(mockConfig as ConfigService);
  });

  it('should generate an iframe token and iframe URL', async () => {
    const result = await service.createIframeToken({
      merchantOid: 'INV-2026-001',
      email: 'ahmet@example.com',
      paymentAmount: 1500,
      userName: 'Ahmet Yılmaz',
      userPhone: '5551234567',
      userIp: '127.0.0.1',
      basket: [{ name: 'Periyodik Bakım', price: '1500.00', quantity: 1 }],
    });

    expect(result.token).toBeDefined();
    expect(result.iframeUrl).toContain('paytr.com/odeme/guvenli');
    expect(result.isTest).toBe(true);
  });

  it('should verify test hash successfully in test mode', () => {
    const isValid = service.verifyWebhook({
      merchant_oid: 'INV-2026-001',
      status: 'success',
      total_amount: '150000',
      hash: 'test_valid_hash_xyz',
    });

    expect(isValid).toBe(true);
  });

  it('should reject invalid webhook payloads with missing fields', () => {
    const isValid = service.verifyWebhook({
      merchant_oid: '',
      status: 'success',
      total_amount: '',
      hash: '',
    });

    expect(isValid).toBe(false);
  });
});
