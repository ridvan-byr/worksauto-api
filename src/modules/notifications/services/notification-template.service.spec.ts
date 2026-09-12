import { describe, it, expect } from 'vitest';
import {
  NotificationTemplateService,
  WORK_ORDER_STATUS_LABELS_TR,
} from './notification-template.service';

describe('NotificationTemplateService', () => {
  const service = new NotificationTemplateService();

  describe('Turkish Labels', () => {
    it('should map all standard status codes to 100% Turkish labels', () => {
      expect(service.getWorkOrderStatusLabel('QUEUE')).toBe(
        'Servis Sırasında (Kabul Edildi)',
      );
      expect(service.getWorkOrderStatusLabel('IN_PROGRESS')).toBe(
        'İşleme Alındı / Onarımda',
      );
      expect(service.getWorkOrderStatusLabel('COMPLETED')).toBe(
        'Tamamlandı / Teslime Hazır',
      );
      expect(service.getWorkOrderStatusLabel('CANCELLED')).toBe('İptal Edildi');
    });

    it('should return fallback string if status code is unknown', () => {
      expect(service.getWorkOrderStatusLabel('UNKNOWN_STATUS')).toBe(
        'UNKNOWN_STATUS',
      );
    });
  });

  describe('URL Generators', () => {
    it('should generate tracking, payment, and consent URLs with app base URL', () => {
      const tracking = service.getTrackingUrl('wo-uuid-123');
      expect(tracking).toContain('/track/wo-uuid-123');

      const payment = service.getPaymentUrl('inv-uuid-456');
      expect(payment).toContain('/pay/inv-uuid-456');

      const consent = service.getConsentUrl('token-789');
      expect(consent).toContain('/c/kvkk?token=token-789');
    });
  });

  describe('Customer Message Formatters', () => {
    it('should format work order created message with polite Turkish and tracking link', () => {
      const msg = service.formatWorkOrderCreatedCustomerMessage({
        customerName: 'Ahmet Yılmaz',
        plate: '34ABC123',
        workOrderNumber: 'WO-2026-0001',
        trackingUrl: 'https://app.worksauto.com/track/123',
        tenantTitle: 'Yıldız Oto Bosch Service',
      });

      expect(msg).toContain('Sayın Ahmet Yılmaz');
      expect(msg).toContain('34ABC123 plakalı aracınızın servis kabulü yapılmıştır');
      expect(msg).toContain('İş Emri: WO-2026-0001');
      expect(msg).toContain('https://app.worksauto.com/track/123');
      expect(msg).toContain('Yıldız Oto Bosch Service');
      expect(msg).not.toContain('QUEUE');
    });

    it('should format status changed message without English enums', () => {
      const msg = service.formatWorkOrderStatusChangedCustomerMessage({
        customerName: 'Mehmet Demir',
        plate: '06XYZ99',
        workOrderNumber: 'WO-2026-0002',
        status: 'IN_PROGRESS',
        trackingUrl: 'https://app.worksauto.com/track/456',
        tenantTitle: 'Merkez Motor',
      });

      expect(msg).toContain('Sayın Mehmet Demir');
      expect(msg).toContain('"İşleme Alındı / Onarımda" aşamasına alınmıştır');
      expect(msg).not.toContain('IN_PROGRESS');
      expect(msg).toContain('https://app.worksauto.com/track/456');
    });

    it('should format completed message with polite wording', () => {
      const msg = service.formatWorkOrderCompletedCustomerMessage({
        customerName: 'Ayşe Kaya',
        plate: '35DEF45',
        workOrderNumber: 'WO-2026-0003',
        trackingUrl: 'https://app.worksauto.com/track/789',
        tenantTitle: 'Ege Oto',
      });

      expect(msg).toContain('Sayın Ayşe Kaya');
      expect(msg).toContain('tüm servis ve onarım işlemleri başarıyla tamamlanmış');
      expect(msg).toContain('teslime hazır hale getirilmiştir');
      expect(msg).toContain('https://app.worksauto.com/track/789');
    });

    it('should format invoice created message with currency and payment link', () => {
      const msg = service.formatInvoiceCreatedCustomerMessage({
        customerName: 'Fatma Şahin',
        invoiceNumber: 'INV-2026-0010',
        grandTotal: 15450.5,
        paymentUrl: 'https://app.worksauto.com/pay/inv-10',
        tenantTitle: 'Anadolu Servis',
      });

      expect(msg).toContain('Sayın Fatma Şahin');
      expect(msg).toContain('INV-2026-0010 numaralı servis faturanız düzenlenmiştir');
      expect(msg).toContain('https://app.worksauto.com/pay/inv-10');
      expect(msg).toContain('Anadolu Servis');
    });

    it('should format KVKK consent SMS message', () => {
      const msg = service.formatConsentSmsMessage({
        customerName: 'Ali Veli',
        consentUrl: 'https://app.worksauto.com/c/kvkk?token=tok-1',
        tenantTitle: 'Zirve Oto',
      });

      expect(msg).toContain('Sayın Ali Veli');
      expect(msg).toContain('Zirve Oto servis kayıt ve KVKK aydınlatma onayınızı tamamlamak için linke tıklayınız');
      expect(msg).toContain('https://app.worksauto.com/c/kvkk?token=tok-1');
    });
  });

  describe('Branded HTML Email Generator', () => {
    it('should render HTML with DOCTYPE, responsive table, brand header and CTA button', () => {
      const html = service.generateBrandedHtmlEmail({
        title: 'Servis Kabul Bildirimi',
        customerName: 'Can Koç',
        message: 'Aracınızın kabul işlemleri tamamlanmıştır.',
        buttonText: 'Canlı Takip',
        buttonUrl: 'https://app.worksauto.com/track/123',
        tenantTitle: 'Koç Otomotiv',
        extraDetails: {
          'İş Emri': 'WO-100',
          Plaka: '34CAN34',
        },
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Koç Otomotiv');
      expect(html).toContain('Sayın <strong>Can Koç</strong>');
      expect(html).toContain('Canlı Takip');
      expect(html).toContain('https://app.worksauto.com/track/123');
      expect(html).toContain('WO-100');
      expect(html).toContain('34CAN34');
      expect(html).toContain('WorksAuto sistemi tarafından otomatik olarak gönderilmiştir');
    });
  });
});
