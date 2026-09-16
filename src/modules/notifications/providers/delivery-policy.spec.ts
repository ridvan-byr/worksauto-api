import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliveryDecision } from './delivery-policy';
import { GowaWhatsAppProvider } from './gowa-whatsapp.provider';
import { QueueService } from '../../queues/queue.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('test delivery isolation', () => {
  it.each(['CI', 'VITEST'])(
    'blocks every transport in %s even with live configuration',
    async (flag) => {
      vi.stubEnv('CI', '');
      vi.stubEnv('VITEST', '');
      vi.stubEnv(flag, 'true');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NOTIFICATION_DELIVERY_MODE', 'live');
      vi.stubEnv('NETGSM_USERCODE', 'configured');
      vi.stubEnv('NETGSM_PASSWORD', 'configured');
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const provider = new GowaWhatsAppProvider();
      const sendMail = vi.fn();
      (provider as any).mailTransporter = { sendMail };
      for (const send of [
        provider.sendSms.bind(provider),
        provider.sendWhatsApp.bind(provider),
        provider.sendEmail.bind(provider),
      ]) {
        expect(
          await send({ to: 'unapproved@example.invalid', message: 'test' }),
        ).toMatchObject({ suppressed: true });
      }
      expect(fetch).not.toHaveBeenCalled();
      expect(sendMail).not.toHaveBeenCalled();
      const queue = new QueueService();
      const add = vi.fn();
      (queue as any).notificationsQueue = { add };
      await queue.addNotificationJob('send-sms', { to: '05523741500' });
      await queue.scheduleAppointmentReminder('appointment', 1000, {});
      expect(add).not.toHaveBeenCalled();
    },
  );

  it('only permits the approved recipient in manual allowlist mode', () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NOTIFICATION_DELIVERY_MODE', 'allowlist');
    for (const phone of ['05523741500', '+90 552 374 15 00', '5523741500']) {
      expect(deliveryDecision(phone, 'sms')).toBeNull();
    }
    expect(deliveryDecision('ridvanemrebayar@gmail.com', 'email')).toBeNull();
    expect(deliveryDecision('other@example.invalid', 'email')?.success).toBe(
      false,
    );
    expect(deliveryDecision('05550000000', 'whatsapp')?.success).toBe(false);
  });

  it('permits all recipients in live or direct mode when not in automated test', () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'development');

    vi.stubEnv('NOTIFICATION_DELIVERY_MODE', 'live');
    expect(deliveryDecision('customer@anydomain.com', 'email')).toBeNull();
    expect(deliveryDecision('05321112233', 'sms')).toBeNull();

    vi.stubEnv('NOTIFICATION_DELIVERY_MODE', 'direct');
    expect(deliveryDecision('customer@anydomain.com', 'email')).toBeNull();
    expect(deliveryDecision('05321112233', 'sms')).toBeNull();
  });
});
