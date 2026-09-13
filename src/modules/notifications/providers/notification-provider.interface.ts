export interface SendNotificationOptions {
  to: string;
  recipientName?: string;
  message: string;
  subject?: string;
  html?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppDeviceStatus {
  connected: boolean;
  state: string;
  jid?: string;
  displayName?: string;
  error?: string;
}

export interface WhatsAppQrResult {
  success: boolean;
  qrLink?: string;
  qrBase64?: string;
  qrDuration?: number;
  error?: string;
}

export interface NotificationProvider {
  readonly providerName: string;
  sendSms(options: SendNotificationOptions): Promise<NotificationResult>;
  sendWhatsApp(options: SendNotificationOptions): Promise<NotificationResult>;
  sendEmail(options: SendNotificationOptions): Promise<NotificationResult>;
  getWhatsAppStatus?(deviceId?: string): Promise<WhatsAppDeviceStatus>;
  getWhatsAppQr?(deviceId?: string): Promise<WhatsAppQrResult>;
  disconnectWhatsApp?(deviceId?: string): Promise<{ success: boolean; error?: string }>;
}

export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';
