import { NotificationResult } from './notification-provider.interface';

export const TEST_PHONE = '05523741500';
export const TEST_EMAIL = 'ridvanemrebayar@gmail.com';

export function isAutomatedTest(): boolean {
  return Boolean(
    (process.env.CI && process.env.CI !== 'false') ||
    process.env.VITEST ||
    process.env.NODE_ENV === 'test',
  );
}

export function suppressNotificationDelivery(): boolean {
  if (isAutomatedTest()) return true;
  const mode = (process.env.NOTIFICATION_DELIVERY_MODE || '')
    .trim()
    .toLowerCase();
  return !['live', 'direct', 'allowlist'].includes(mode);
}

/** Runs before any network call. Automated tests cannot opt into live delivery. */
export function deliveryDecision(
  to: string,
  channel: 'email' | 'sms' | 'whatsapp',
): NotificationResult | null {
  if (suppressNotificationDelivery()) {
    return {
      success: true,
      suppressed: true,
      messageId: 'suppressed-test-delivery',
    };
  }
  const mode = (process.env.NOTIFICATION_DELIVERY_MODE || '')
    .trim()
    .toLowerCase();
  if (mode === 'allowlist') {
    const digits = to.replace(/\D/g, '');
    const allowed =
      channel === 'email'
        ? to.trim().toLowerCase() === TEST_EMAIL
        : ['05523741500', '5523741500', '905523741500'].includes(digits);
    if (!allowed)
      return {
        success: false,
        error: 'Recipient is not on the test delivery allowlist.',
      };
  }
  return null;
}
