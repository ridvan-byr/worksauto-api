import { Injectable } from '@nestjs/common';

export const WORK_ORDER_STATUS_LABELS_TR: Record<string, string> = {
  QUEUE: 'Servis Sırasında (Kabul Edildi)',
  IN_PROGRESS: 'İşleme Alındı / Onarımda',
  COMPLETED: 'Tamamlandı / Teslime Hazır',
  CANCELLED: 'İptal Edildi',
};

@Injectable()
export class NotificationTemplateService {
  /**
   * WorksAuto Web uygulaması taban adresi
   */
  getAppBaseUrl(): string {
    const raw =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://app.worksauto.com';
    return raw.replace(/\/+$/, '');
  }

  getTrackingUrl(workOrderId: string): string {
    return `${this.getAppBaseUrl()}/track/${workOrderId}`;
  }

  getPaymentUrl(invoiceId: string): string {
    return `${this.getAppBaseUrl()}/pay/${invoiceId}`;
  }

  getConsentUrl(token: string): string {
    return `${this.getAppBaseUrl()}/c/kvkk?token=${token}`;
  }

  /**
   * İş emri durumunu Türkçe kullanıcı dostu metne dönüştürür
   */
  getWorkOrderStatusLabel(status: string): string {
    return WORK_ORDER_STATUS_LABELS_TR[status] || status;
  }


  /**
   * 1. İş Emri Kabul Mesajı (Müşteri Canlı Takip Linki ile)
   */
  formatWorkOrderCreatedCustomerMessage(params: {
    customerName: string;
    plate: string;
    workOrderNumber: string;
    trackingUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın servis kabulü yapılmıştır (İş Emri: ${params.workOrderNumber}). Yapılan işlemleri ve hasar/onarım fotoğraflarını anlık canlı takip etmek için: ${params.trackingUrl} - ${params.tenantTitle}`;
  }

  /**
   * 2. İş Emri Durum Değişikliği Mesajı
   */
  formatWorkOrderStatusChangedCustomerMessage(params: {
    customerName: string;
    plate: string;
    workOrderNumber: string;
    status: string;
    trackingUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    const statusTr = this.getWorkOrderStatusLabel(params.status);
    return `${greeting}, ${plateStr}aracınız "${statusTr}" aşamasına alınmıştır. Güncel durumu canlı takip etmek için: ${params.trackingUrl} - ${params.tenantTitle}`;
  }

  /**
   * 3. İş Emri Tamamlandı (Teslime Hazır) Mesajı
   */
  formatWorkOrderCompletedCustomerMessage(params: {
    customerName: string;
    plate: string;
    workOrderNumber: string;
    trackingUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın tüm servis ve onarım işlemleri başarıyla tamamlanmış ve teslime hazır hale getirilmiştir. Detaylar: ${params.trackingUrl} - ${params.tenantTitle}`;
  }

  /**
   * 4. Fatura Kesildi ve Ödeme Linki Mesajı
   */
  formatInvoiceCreatedCustomerMessage(params: {
    customerName: string;
    invoiceNumber: string;
    grandTotal: number;
    paymentUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    const amountStr = params.grandTotal.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${greeting}, ${params.invoiceNumber} numaralı servis faturanız düzenlenmiştir (Tutar: ${amountStr} ₺). Kredi kartı ile güvenli ve hızlı ödemek için: ${params.paymentUrl} - ${params.tenantTitle}`;
  }

  /**
   * 5. KVKK Aydınlatma ve Açık Rıza Onay Linki SMS'i
   */
  formatConsentSmsMessage(params: {
    customerName: string;
    consentUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    return `${greeting}, ${params.tenantTitle} servis kayıt ve KVKK aydınlatma onayınızı tamamlamak için linke tıklayınız: ${params.consentUrl}`;
  }

  /**
   * 6. Randevu Hatırlatma Mesajı (2 Saat Kala)
   */
  formatAppointmentReminderMessage(params: {
    customerName: string;
    plate: string;
    dateStr: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName ? `Sayın ${params.customerName}` : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın ${params.dateStr} tarihindeki servis randevusunu hatırlatırız. İyi günler dileriz. - ${params.tenantTitle}`;
  }

  /**
   * Profesyonel HTML E-Posta Şablonu Üretici
   */
  generateBrandedHtmlEmail(params: {
    title: string;
    customerName: string;
    message: string;
    buttonText?: string;
    buttonUrl?: string;
    tenantTitle: string;
    extraDetails?: Record<string, string>;
  }): string {
    const detailsHtml = params.extraDetails
      ? Object.entries(params.extraDetails)
          .map(
            ([key, val]) =>
              `<tr><td style="padding: 6px 12px; color: #64748b; font-weight: 600; width: 40%;">${key}:</td><td style="padding: 6px 12px; color: #0f172a; font-weight: 500;">${val}</td></tr>`,
          )
          .join('')
      : '';

    const buttonHtml =
      params.buttonUrl && params.buttonText
        ? `<div style="text-align: center; margin: 32px 0 16px;">
            <a href="${params.buttonUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
              ${params.buttonText}
            </a>
          </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">${params.tenantTitle}</h1>
              <span style="color: #94a3b8; font-size: 13px;">Oto Servis Yönetim ve Canlı Takip Sistemi</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 16px;">${params.title}</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Sayın <strong>${params.customerName || 'Müşterimiz'}</strong>,
              </p>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                ${params.message}
              </p>
              ${
                detailsHtml
                  ? `<table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                      ${detailsHtml}
                    </table>`
                  : ''
              }
              ${buttonHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <!-- WorksAuto Brand Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 12px;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 8px;">
                    <div style="background-color: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 6px; font-weight: 900; font-size: 15px; line-height: 28px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
                      W
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <span style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; display: block;">Works<span style="color: #2563eb;">Auto</span></span>
                    <span style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Akıllı Oto Servis Altyapısı</span>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
                Bu e-posta <strong>${params.tenantTitle}</strong> adına <strong>WorksAuto</strong> canlı araç takip altyapısı tarafından otomatik olarak gönderilmiştir.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin-top: 6px; margin-bottom: 0;">
                © 2026 WorksAuto. Tüm hakları saklıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
