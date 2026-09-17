import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

  /**
   * Orijinal WorksAuto marka logosunun dosya yolunu çözer
   */
  resolveLogoPath(): string | null {
    try {
      const candidates = [
        path.join(
          __dirname,
          '../../../../assets/brand/worksauto-logo-dark.png',
        ),
        path.join(process.cwd(), 'assets/brand/worksauto-logo-dark.png'),
        path.join(process.cwd(), '../assets/brand/worksauto-logo-dark.png'),
        path.join(
          process.cwd(),
          'worksauto-api/assets/brand/worksauto-logo-dark.png',
        ),
        path.join(
          process.cwd(),
          'worksauto-web/public/brand/worksauto-logo-dark.png',
        ),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
    } catch {}
    return null;
  }

  /**
   * Nodemailer için CID inline attachment nesnesi döner (Gmail'de kırılmayan logo için)
   */
  getLogoAttachment(): { filename: string; path: string; cid: string } | null {
    const p = this.resolveLogoPath();
    if (p) {
      return {
        filename: 'worksauto-logo.png',
        path: p,
        cid: 'worksauto-logo',
      };
    }
    return null;
  }

  /**
   * Orijinal WorksAuto marka logosunun güvenilir HTTPS CDN / Web URL'sini döner.
   * E-posta gövdesinde harici ek (attachment) oluşturmaması için halka açık HTTPS URL kullanılır.
   */
  getWorksAutoLogoSrc(): string {
    if (process.env.BRAND_LOGO_URL) {
      return process.env.BRAND_LOGO_URL;
    }
    // Halka açık, yüksek erişilebilirlikli WorksAuto orijinal logo CDN adresi
    return 'https://raw.githubusercontent.com/ridvan-byr/worksauto-web/main/public/brand/worksauto-logo-dark.png';
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
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın servis kabulü yapılmıştır (İş Emri: ${params.workOrderNumber}).\n\nYapılan işlemleri ve hasar/onarım fotoğraflarını anlık canlı takip etmek için:\n${params.trackingUrl}\n\n${params.tenantTitle}`;
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
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    const statusTr = this.getWorkOrderStatusLabel(params.status);
    return `${greeting}, ${plateStr}aracınız "${statusTr}" aşamasına alınmıştır.\n\nGüncel durumu canlı takip etmek için:\n${params.trackingUrl}\n\n${params.tenantTitle}`;
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
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın tüm servis ve onarım işlemleri başarıyla tamamlanmış ve teslime hazır hale getirilmiştir.\n\nDetaylar:\n${params.trackingUrl}\n\n${params.tenantTitle}`;
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
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const amountStr = params.grandTotal.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${greeting}, ${params.invoiceNumber} numaralı servis faturanız düzenlenmiştir (Tutar: ${amountStr} ₺).\n\nKredi kartı ile güvenli ve hızlı ödemek için:\n${params.paymentUrl}\n\n${params.tenantTitle}`;
  }

  /**
   * 5. KVKK Aydınlatma ve Açık Rıza Onay Linki SMS'i
   */
  formatConsentSmsMessage(params: {
    customerName: string;
    consentUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    return `${greeting},\n\n${params.tenantTitle} servis kayıt ve KVKK aydınlatma onayınızı tamamlamak için linke tıklayınız:\n${params.consentUrl}`;
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
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınızın ${params.dateStr} tarihindeki servis randevusunu hatırlatırız. İyi günler dileriz. - ${params.tenantTitle}`;
  }

  /**
   * 7. Randevu Oluşturuldu Teyit Mesajı
   */
  formatAppointmentCreatedCustomerMessage(params: {
    customerName: string;
    plate: string;
    dateStr: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınız için ${params.dateStr} tarihine servis randevunuz başarıyla oluşturulmuştur. Sizleri aramızda görmekten mutluluk duyarız. - ${params.tenantTitle}`;
  }

  /**
   * 7b. Randevu Yeniden Planlandı (Ertelendi) Müşteri Mesajı
   * Randevu Güncelleme / Erteleme / Erkene Alma Müşteri SMS & WhatsApp Şablonu
   */
  formatAppointmentRescheduledCustomerMessage(params: {
    customerName?: string;
    plate?: string;
    dateFormatted: string;
    timeFormatted: string;
    reason?: string;
    tenantTitle?: string;
    isEarlier?: boolean;
  }): string {
    const greeting = params.customerName?.trim()
      ? `Sayın ${params.customerName.trim()}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    const tenantStr = params.tenantTitle?.trim()
      ? ` - ${params.tenantTitle.trim()}`
      : '';

    if (params.isEarlier) {
      const reasonStr = params.reason?.trim()
        ? ` (${params.reason.trim()})`
        : '';
      return `${greeting}, ${plateStr}aracınızın servis randevusu talebiniz/oluşan müsaitlik doğrultusunda ${params.dateFormatted} saat ${params.timeFormatted} olarak erkene alınmıştır.${reasonStr}${tenantStr}`;
    }

    const reasonStr = params.reason?.trim()
      ? ` (Erteleme Nedeni: ${params.reason.trim()})`
      : '';
    return `${greeting}, ${plateStr}aracınızın servis randevusu ${params.dateFormatted} saat ${params.timeFormatted} olarak güncellenmiştir.${reasonStr}${tenantStr}`;
  }

  /**
   * Türkiye Yerel Saat Dilimine (Europe/Istanbul - UTC+3) Göre Tarih & Saat Formatlar
   */
  formatTurkeyDateTime(
    slotDate?: string,
    slotStartTime?: string | Date,
  ): { dateFormatted: string; timeFormatted: string; fullStr: string } {
    let dateObj: Date;
    if (slotStartTime instanceof Date) {
      dateObj = slotStartTime;
    } else if (
      typeof slotStartTime === 'string' &&
      (slotStartTime.includes('T') || slotStartTime.includes('Z'))
    ) {
      dateObj = new Date(slotStartTime);
    } else if (
      typeof slotStartTime === 'string' &&
      slotStartTime.includes(':')
    ) {
      const [h, m] = slotStartTime.split(':').map(Number);
      const [y, mon, d] = (slotDate || '').split('-').map(Number);
      dateObj = new Date(
        Date.UTC(y || 2026, (mon || 1) - 1, d || 1, (h || 0) - 3, m || 0, 0),
      );
    } else if (slotStartTime) {
      dateObj = new Date(slotStartTime);
    } else if (slotDate) {
      const [y, mon, d] = slotDate.split('-').map(Number);
      dateObj = new Date(Date.UTC(y, mon - 1, d, 9, 0, 0));
    } else {
      dateObj = new Date();
    }

    const timeFormatted = dateObj.toLocaleTimeString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const dateFormatted = dateObj.toLocaleDateString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
    });

    const fullStr = `${dateFormatted} saat ${timeFormatted}`;

    return { dateFormatted, timeFormatted, fullStr };
  }

  /**
   * 8. Tahsilat / Ödeme Alındı Makbuzu Mesajı
   */
  formatPaymentReceivedCustomerMessage(params: {
    customerName: string;
    amount: number;
    invoiceNumber?: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const amountStr = params.amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const invStr = params.invoiceNumber
      ? ` (${params.invoiceNumber} nolu fatura)`
      : '';
    return `${greeting}, ${amountStr} ₺ tutarındaki servis ödemeniz başarıyla tahsil edilmiştir${invStr}. Bizi tercih ettiğiniz için teşekkür ederiz. - ${params.tenantTitle}`;
  }

  /**
   * 9. İş Emri İptal Edildi Mesajı
   */
  formatWorkOrderCancelledCustomerMessage(params: {
    customerName: string;
    plate: string;
    workOrderNumber: string;
    trackingUrl: string;
    tenantTitle: string;
  }): string {
    const greeting = params.customerName
      ? `Sayın ${params.customerName}`
      : 'Sayın Müşterimiz';
    const plateStr = params.plate ? `${params.plate} plakalı ` : '';
    return `${greeting}, ${plateStr}aracınıza ait ${params.workOrderNumber} numaralı servis iş emri iptal edilmiştir.\n\nDetaylar ve iletişim:\n${params.trackingUrl}\n\n${params.tenantTitle}`;
  }

  /**
   * 10. WorksAuto Yeni Servis Sahibi (Owner) Hoş Geldiniz E-Postası
   */
  formatServiceOwnerWelcomeEmail(params: {
    ownerName: string;
    tenantTitle: string;
    slug: string;
  }): { subject: string; html: string; text: string } {
    const panelUrl = process.env.PANEL_DOMAIN
      ? `https://${process.env.PANEL_DOMAIN}`
      : 'http://localhost:3000';
    const bookingUrl = `${panelUrl}/book/${params.slug}`;

    const subject = `WorksAuto Servis Yönetim Ailesine Hoş Geldiniz! - ${params.tenantTitle}`;
    const text = `Sayın ${params.ownerName},\n\nWorksAuto Servis Yönetim Ailesine hoş geldiniz! ${params.tenantTitle} servisinizin kurulumu başarıyla tamamlanmıştır.\n\nYönetim Paneli: ${panelUrl}\nOnline Randevu Sayfanız: ${bookingUrl}\n\nİyi çalışmalar dileriz,\nWorksAuto Ekibi`;

    const html = this.generateBrandedHtmlEmail({
      title: 'WorksAuto Ailesine Hoş Geldiniz!',
      customerName: `${params.ownerName} (İşletme Sahibi / Yöneticisi)`,
      message: `Tebrikler! <strong>${params.tenantTitle}</strong> servisinizin WorksAuto platformu üzerindeki kaydı başarıyla oluşturulmuştur. Artık tüm servis, iş emri, yedek parça, faturalama ve usta süreçlerinizi tek ekrandan modern ve kesintisiz şekilde yönetebilirsiniz.`,
      tenantTitle: 'WorksAuto Servis Yönetim Platformu',
      buttonText: 'Servis Yönetim Paneline Git',
      buttonUrl: panelUrl,
      extraDetails: {
        'İşletme / Servis Adı': params.tenantTitle,
        'Servis URL Kodu (Slug)': params.slug,
        'Müşteri Randevu Linki': bookingUrl,
        'Başlangıç Adımı 1':
          'Servis Ayarlarından logonuzu ve kurumsal bilgilerinizi tamamlayın.',
        'Başlangıç Adımı 2':
          'Faaliyet alanlarınızı ve paketlerinizi seçip servisinize aktarın.',
        'Başlangıç Adımı 3':
          'Ustalarınızı, teknisyenlerinizi ve liftlerinizi tanımlayın.',
        'Başlangıç Adımı 4':
          'Müşterilerinizle online randevu linkinizi paylaşın.',
      },
    });

    return { subject, html, text };
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
    tenantLogoUrl?: string;
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

    const fullTenantLogoUrl = params.tenantLogoUrl
      ? params.tenantLogoUrl.startsWith('http://') ||
        params.tenantLogoUrl.startsWith('https://')
        ? params.tenantLogoUrl
        : `${this.getAppBaseUrl()}${params.tenantLogoUrl.startsWith('/') ? '' : '/'}${params.tenantLogoUrl}`
      : null;

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
            <td style="background-color: #0f172a; padding: 24px 28px;">
              ${
                fullTenantLogoUrl
                  ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="left" style="vertical-align: middle; width: 56px; padding-right: 16px;">
                          <img src="${fullTenantLogoUrl}" alt="${params.tenantTitle}" style="max-height: 48px; max-width: 140px; object-fit: contain; display: block; border: 0;" />
                        </td>
                        <td align="left" style="vertical-align: middle;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">${params.tenantTitle}</h1>
                          <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">Oto Servis Yönetim ve Canlı Takip Sistemi</div>
                        </td>
                      </tr>
                    </table>`
                  : `<div style="text-align: center;">
                       <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">${params.tenantTitle}</h1>
                       <div style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Oto Servis Yönetim ve Canlı Takip Sistemi</div>
                     </div>`
              }
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
              <!-- WorksAuto Original Brand Logo (Hosted HTTPS URL) -->
              <div style="margin-bottom: 14px; text-align: center;">
                <img src="${this.getWorksAutoLogoSrc()}" alt="WorksAuto" width="145" style="display: block; margin: 0 auto; width: 145px; max-width: 160px; height: auto; border: 0; outline: none; text-decoration: none;" />
              </div>
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
