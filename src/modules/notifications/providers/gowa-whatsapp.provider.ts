import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  NotificationProvider,
  SendNotificationOptions,
  NotificationResult,
  WhatsAppDeviceStatus,
  WhatsAppQrResult,
} from './notification-provider.interface';

@Injectable()
export class GowaWhatsAppProvider implements NotificationProvider {
  readonly providerName = 'GowaWhatsAppProvider';
  private readonly logger = new Logger(GowaWhatsAppProvider.name);
  private readonly gowaBaseUrl: string;
  private readonly mailTransporter: Transporter | null = null;
  private readonly smtpFrom: string;

  constructor() {
    this.gowaBaseUrl = process.env.WHATSAPP_API_URL || 'http://localhost:8080';
    this.smtpFrom =
      process.env.SMTP_FROM || 'WorksAuto Servis <bildirim@worksauto.com>';

    // Gerçek SMTP sunucusu yapılandırılmışsa Nodemailer'ı başlat
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT) || 587;
      const isSecure =
        process.env.SMTP_SECURE === 'true' || port === 465;

      this.mailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: isSecure,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });

      this.logger.log(
        `📧 [SMTP Yapılandırıldı] Host: ${process.env.SMTP_HOST}:${port} | Kimlik: ${process.env.SMTP_USER ? 'Aktif' : 'Yok'}`,
      );
    } else {
      this.logger.warn(
        '⚠️ [SMTP Eksik] SMTP_HOST ortam değişkeni tanımlanmamış. E-postalar konsola simüle edilecek.',
      );
    }
  }

  /**
   * Telefon numarasını WhatsApp/E.164 uluslararası formatına (örn: 905xxxxxxxxx) normalize eder
   */
  public formatPhoneNumber(phone: string): string {
    let clean = (phone || '').replace(/\D/g, '');
    if (!clean) return '';

    // 05xx xxx xx xx (11 haneli yerel TR) -> 905xx xxx xx xx
    if (clean.startsWith('0') && clean.length === 11 && clean.charAt(1) === '5') {
      clean = '90' + clean.substring(1);
    }
    // 5xx xxx xx xx (10 haneli başında 0 olmayan TR) -> 905xx xxx xx xx
    else if (clean.length === 10 && clean.startsWith('5')) {
      clean = '90' + clean;
    }
    return clean;
  }

  /**
   * GOWA üzerinde cihaz kaydının (slotunun) varlığını garanti eder, yoksa POST /devices ile oluşturur
   */
  public async ensureDeviceExists(deviceId: string = 'default'): Promise<boolean> {
    try {
      const res = await fetch(`${this.gowaBaseUrl}/devices`, { method: 'GET' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.results) ? data.results : [];
        const exists = list.some((d: any) => d.id === deviceId);
        if (exists) return true;
      }

      // Slot oluştur
      const createRes = await fetch(`${this.gowaBaseUrl}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      return createRes.ok;
    } catch (err: any) {
      this.logger.warn(`GOWA ensureDeviceExists hatası: ${err.message}`);
      return false;
    }
  }

  /**
   * Cihazın canlı WhatsApp bağlantı durumunu sorgular
   */
  async getWhatsAppStatus(deviceId: string = 'default'): Promise<WhatsAppDeviceStatus> {
    try {
      await this.ensureDeviceExists(deviceId);
      const res = await fetch(
        `${this.gowaBaseUrl}/devices/${encodeURIComponent(deviceId)}/status`,
      );
      if (!res.ok) {
        return {
          connected: false,
          state: 'disconnected',
          error: `GOWA status HTTP ${res.status}`,
        };
      }
      const data = await res.json().catch(() => ({}));
      const results = data.results || {};
      const isConnected = results.state === 'connected' || !!results.jid;

      return {
        connected: isConnected,
        state: results.state || (isConnected ? 'connected' : 'disconnected'),
        jid: results.jid,
        displayName: results.display_name,
      };
    } catch (err: any) {
      return {
        connected: false,
        state: 'unreachable',
        error: `GOWA servisine ulaşılamadı: ${err.message}`,
      };
    }
  }

  /**
   * WhatsApp eşleştirmesi için QR kod alır
   */
  async getWhatsAppQr(deviceId: string = 'default'): Promise<WhatsAppQrResult> {
    try {
      await this.ensureDeviceExists(deviceId);
      const res = await fetch(
        `${this.gowaBaseUrl}/devices/${encodeURIComponent(deviceId)}/login`,
      );
      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          error: `QR kod alınamadı (${res.status}): ${errText}`,
        };
      }
      const data = await res.json().catch(() => ({}));
      const results = data.results || {};
      let qrBase64: string | undefined = undefined;

      if (results.qr_link) {
        try {
          const imgRes = await fetch(results.qr_link);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            qrBase64 = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
          }
        } catch {
          // fallback to qr_link directly
        }
      }

      return {
        success: true,
        qrLink: results.qr_link,
        qrBase64,
        qrDuration: results.qr_duration || 30,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `GOWA servisiyle bağlantı kurulamadı: ${err.message}`,
      };
    }
  }

  /**
   * WhatsApp cihaz oturumunu kapatır
   */
  async disconnectWhatsApp(
    deviceId: string = 'default',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(
        `${this.gowaBaseUrl}/devices/${encodeURIComponent(deviceId)}/logout`,
        {
          method: 'POST',
        },
      );
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * WhatsApp Mesaj İletimi (GOWA Gateway)
   */
  async sendWhatsApp(
    options: SendNotificationOptions,
  ): Promise<NotificationResult> {
    try {
      const cleanPhone = this.formatPhoneNumber(options.to);
      const deviceId =
        options.metadata?.deviceId ||
        process.env.WHATSAPP_DEVICE_ID ||
        'default';

      await this.ensureDeviceExists(deviceId);

      const url = `${this.gowaBaseUrl}/send/message`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      };

      this.logger.log(
        `💬 [GOWA WhatsApp Gönderim] -> ${cleanPhone} (Orj: ${options.to}) | Tenant: ${options.tenantId || 'global'}`,
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: cleanPhone,
          message: options.message,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(
          `GOWA WhatsApp yanıt hatası (${res.status}): ${errText}`,
        );
        return {
          success: false,
          error: `WhatsApp iletimi başarısız oldu (${res.status}): ${errText}`,
        };
      }

      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        messageId: data.id || `gowa-${Date.now()}`,
      };
    } catch (err: any) {
      this.logger.warn(
        `GOWA WhatsApp bağlantı hatası (${err.message}). WhatsApp servisi bağlı olmayabilir.`,
      );

      // Sadece WHATSAPP_MOCK_MODE=true ise veya test ortamında sahte başarı dön
      if (
        process.env.WHATSAPP_MOCK_MODE === 'true' ||
        process.env.NODE_ENV === 'test'
      ) {
        return {
          success: true,
          messageId: `gowa-mock-${Date.now()}`,
        };
      }

      return {
        success: false,
        error: `WhatsApp servisine (${this.gowaBaseUrl}) bağlanılamadı: ${err.message}`,
      };
    }
  }

  /**
   * E-Posta İletimi (Gerçek SMTP / Nodemailer veya Fallback)
   */
  async sendEmail(
    options: SendNotificationOptions,
  ): Promise<NotificationResult> {
    const subject = options.subject || 'WorksAuto Servis Bilgilendirme';

    if (this.mailTransporter) {
      try {
        const info = await this.mailTransporter.sendMail({
          from: this.smtpFrom,
          to: options.to,
          subject,
          text: options.message,
          html: options.html || `<p>${options.message}</p>`,
        });

        this.logger.log(
          `📧 [E-Posta Başarıyla Gönderildi] -> ${options.to} | Konu: "${subject}" | MsgID: ${info.messageId}`,
        );

        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (err: any) {
        this.logger.error(
          `❌ [E-Posta Gönderim Hatası] Alıcı: ${options.to} | Hata: ${err.message}`,
          err.stack,
        );
        return {
          success: false,
          error: `E-posta gönderimi başarısız oldu: ${err.message}`,
        };
      }
    }

    // SMTP tanımlı değilse güvenli konsol logu (Dev / Simülasyon)
    this.logger.log(
      `📧 [E-Posta Simülasyonu] -> Alıcı: ${options.to} | Konu: "${subject}" | Metin: "${options.message.slice(0, 80)}..."`,
    );
    return {
      success: true,
      messageId: `email-sim-${Date.now()}`,
    };
  }

  /**
   * SMS İletimi (Netgsm / Webhook veya Dev Simülasyonu)
   */
  async sendSms(options: SendNotificationOptions): Promise<NotificationResult> {
    const cleanPhone = options.to.replace(/\D/g, '');

    // 1. Netgsm SMS Entegrasyonu
    if (process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD) {
      try {
        const header = process.env.NETGSM_HEADER || 'WORKSAUTO';
        const netgsmUrl = 'https://api.netgsm.com.tr/sms/send/get';
        const params = new URLSearchParams({
          usercode: process.env.NETGSM_USERCODE,
          password: process.env.NETGSM_PASSWORD,
          gsmno: cleanPhone,
          message: options.message,
          msgheader: header,
        });

        const res = await fetch(`${netgsmUrl}?${params.toString()}`, {
          method: 'GET',
        });
        const resText = await res.text();

        // Netgsm 00 veya 01 veya 02 ile başlayan cevaplarda başarı döner
        if (
          resText.startsWith('00') ||
          resText.startsWith('01') ||
          resText.startsWith('02')
        ) {
          const parts = resText.trim().split(' ');
          const messageId = parts[1] || resText;
          this.logger.log(
            `📱 [Netgsm SMS Gönderildi] -> ${cleanPhone} | MesajID: ${messageId}`,
          );
          return { success: true, messageId };
        } else {
          this.logger.error(
            `❌ [Netgsm SMS Hatası] Alıcı: ${cleanPhone} | Kod: ${resText}`,
          );
          return {
            success: false,
            error: `Netgsm SMS gönderim hatası kodu: ${resText}`,
          };
        }
      } catch (err: any) {
        this.logger.error(
          `❌ [Netgsm Bağlantı Hatası] ${err.message}`,
          err.stack,
        );
        return {
          success: false,
          error: `Netgsm SMS servisine ulaşılamadı: ${err.message}`,
        };
      }
    }

    // 2. Genel SMS Webhook API Entegrasyonu (Varsa)
    if (process.env.SMS_API_URL) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (process.env.SMS_API_KEY) {
          headers['Authorization'] = `Bearer ${process.env.SMS_API_KEY}`;
        }
        const res = await fetch(process.env.SMS_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: cleanPhone,
            message: options.message,
            tenantId: options.tenantId,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            error: `SMS API HTTP ${res.status}: ${errText}`,
          };
        }

        const data = await res.json().catch(() => ({}));
        return {
          success: true,
          messageId: data.id || `sms-api-${Date.now()}`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `SMS Webhook Hatası: ${err.message}`,
        };
      }
    }

    // 3. Simülasyon / Dev Modu
    this.logger.log(
      `📱 [SMS Simülasyonu] -> Alıcı: ${cleanPhone} | Mesaj: "${options.message}"`,
    );
    return {
      success: true,
      messageId: `sms-sim-${Date.now()}`,
    };
  }
}

