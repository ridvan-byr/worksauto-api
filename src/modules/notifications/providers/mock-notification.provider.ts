import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationProvider,
  SendNotificationOptions,
  NotificationResult,
} from './notification-provider.interface';

@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  readonly providerName = 'MockNotificationProvider';
  private readonly logger = new Logger(MockNotificationProvider.name);

  async sendSms(options: SendNotificationOptions): Promise<NotificationResult> {
    this.logger.log(
      `📱 [MOCK SMS SENT] -> To: ${options.to} (${options.recipientName || 'Müşteri'}) | Message: "${options.message}" | Tenant: ${options.tenantId || 'system'}`
    );
    return {
      success: true,
      messageId: `mock-sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  async sendWhatsApp(options: SendNotificationOptions): Promise<NotificationResult> {
    this.logger.log(
      `💬 [MOCK WHATSAPP SENT] -> To: ${options.to} | Message: "${options.message}" | Tenant: ${options.tenantId || 'system'}`
    );
    return {
      success: true,
      messageId: `mock-wa-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  async sendEmail(options: SendNotificationOptions): Promise<NotificationResult> {
    this.logger.log(
      `📧 [MOCK EMAIL SENT] -> To: ${options.to} | Subject: "${options.subject || 'WorksAuto Bildirimi'}" | Body: "${options.message.substring(0, 100)}..."`
    );
    return {
      success: true,
      messageId: `mock-mail-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}
