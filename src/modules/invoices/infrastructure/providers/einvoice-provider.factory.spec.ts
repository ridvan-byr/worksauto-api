import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EInvoiceProviderFactory } from './einvoice-provider.factory';
import { InvoiceProviderType } from '@prisma/client';

describe('EInvoiceProviderFactory', () => {
  let factory: EInvoiceProviderFactory;
  let mockPrisma: any;
  let mockCrypto: any;

  beforeEach(() => {
    mockPrisma = {
      tenantInvoiceSetting: {
        findUnique: vi.fn(),
      },
    };
    mockCrypto = {
      decrypt: vi.fn((val) => val?.replace('enc_', '')),
      encrypt: vi.fn((val) => `enc_${val}`),
    };
    factory = new EInvoiceProviderFactory(mockPrisma, mockCrypto);
  });

  it('should return InternalDraftProvider if tenant has no config', async () => {
    mockPrisma.tenantInvoiceSetting.findUnique.mockResolvedValue(null);
    const provider = await factory.getProvider('tenant-1');
    expect(provider.providerName).toBe('INTERNAL');
    const testResult = await provider.testConnection();
    expect(testResult.success).toBe(true);
  });

  it('should return ParasutProvider if tenant has PARASUT config', async () => {
    mockPrisma.tenantInvoiceSetting.findUnique.mockResolvedValue({
      provider: InvoiceProviderType.PARASUT,
      encryptedApiKey: 'enc_test-api-key',
      encryptedApiSecret: 'enc_test-api-secret',
      isTestMode: true,
      seriesPrefix: 'PRT',
    });

    const provider = await factory.getProvider('tenant-1');
    expect(provider.providerName).toBe('PARASUT');
    const testResult = await provider.testConnection();
    expect(testResult.success).toBe(false);
    expect(testResult.message).toContain('henüz');
  });

  it('should return NilveraProvider if tenant has NILVERA config', async () => {
    mockPrisma.tenantInvoiceSetting.findUnique.mockResolvedValue({
      provider: InvoiceProviderType.NILVERA,
      encryptedApiKey: 'enc_nilvera-key',
      isTestMode: true,
      seriesPrefix: 'NLV',
    });

    const provider = await factory.getProvider('tenant-1');
    expect(provider.providerName).toBe('NILVERA');
    const testResult = await provider.testConnection();
    expect(testResult.success).toBe(false);
  });
});
