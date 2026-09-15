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
  return (
    isAutomatedTest() ||
    !['live', 'allowlist'].includes(
      process.env.NOTIFICATION_DELIVERY_MODE || '',
    ) ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.NOTIFICATION_DELIVERY_MODE !== 'allowlist')
  );
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
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.NOTIFICATION_DELIVERY_MODE === 'allowlist'
  ) {
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
