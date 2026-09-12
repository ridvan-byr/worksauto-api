import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GowaWhatsAppProvider } from './gowa-whatsapp.provider';

describe('GowaWhatsAppProvider', () => {
  let provider: GowaWhatsAppProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should instantiate successfully with default settings', () => {
    provider = new GowaWhatsAppProvider();
    expect(provider.providerName).toBe('GowaWhatsAppProvider');
  });

  describe('sendEmail', () => {
    it('should fallback gracefully when SMTP is not configured in dev/test', async () => {
      provider = new GowaWhatsAppProvider();
      const result = await provider.sendEmail({
        to: 'musteri@example.com',
        subject: 'Faturanız',
        message: 'Faturanız hazır.',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendSms', () => {
    it('should log and simulate SMS in dev environment when no SMS gateway env is set', async () => {
      provider = new GowaWhatsAppProvider();
      const result = await provider.sendSms({
        to: '05551112233',
        message: 'Randevunuz onaylandı.',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('sms-sim');
    });

    it('should send SMS via Netgsm when Netgsm credentials are present', async () => {
      process.env.NETGSM_USERCODE = 'test_user';
      process.env.NETGSM_PASSWORD = 'test_pass';

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('00 987654321'),
      } as any);

      provider = new GowaWhatsAppProvider();
      const result = await provider.sendSms({
        to: '05551112233',
        message: 'Test SMS',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('987654321');

      delete process.env.NETGSM_USERCODE;
      delete process.env.NETGSM_PASSWORD;
    });

    it('should handle Netgsm error code gracefully', async () => {
      process.env.NETGSM_USERCODE = 'test_user';
      process.env.NETGSM_PASSWORD = 'test_pass';

      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('30 Geçersiz kullanıcı adı veya şifre'),
      } as any);

      provider = new GowaWhatsAppProvider();
      const result = await provider.sendSms({
        to: '05551112233',
        message: 'Test SMS',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Netgsm SMS gönderim hatası');

      delete process.env.NETGSM_USERCODE;
      delete process.env.NETGSM_PASSWORD;
    });
  });

  describe('sendWhatsApp', () => {
    it('should successfully dispatch when GOWA responds 200 OK', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'msg-gowa-123' }),
      } as any);

      provider = new GowaWhatsAppProvider();
      const result = await provider.sendWhatsApp({
        to: '905551112233',
        message: 'Merhaba, aracınız servise alındı.',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-gowa-123');
    });

    it('should report failure when GOWA responds with non-200 error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized: Device not connected'),
      } as any);

      provider = new GowaWhatsAppProvider();
      const result = await provider.sendWhatsApp({
        to: '905551112233',
        message: 'Merhaba',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('WhatsApp iletimi başarısız oldu (401)');
    });
  });
});
