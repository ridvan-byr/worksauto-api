export interface SendNotificationOptions {
  to: string;
  recipientName?: string;
  message: string;
  subject?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  readonly providerName: string;
  sendSms(options: SendNotificationOptions): Promise<NotificationResult>;
  sendWhatsApp(options: SendNotificationOptions): Promise<NotificationResult>;
  sendEmail(options: SendNotificationOptions): Promise<NotificationResult>;
}

export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';
