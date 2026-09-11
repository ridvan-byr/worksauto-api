import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { SignB2bConsentDto } from './dto/sign-b2b-consent.dto';
import * as crypto from 'crypto';

export const CURRENT_B2B_CONTRACT_VERSION = '1.0';

export const B2B_CONTRACT_TEXT = `
# WORKSAUTO B2B BULUT HİZMET SÖZLEŞMESİ & KVKK VERİ İŞLEYEN PROTOKOLÜ
(Sürüm: 1.0 - Kurumsal Lisans & Yasal Uyum Metni)

1. TARAFLAR VE SÖZLEŞMENİN AMACI
İşbu Sözleşme; WorksAuto Bulut Servis Yönetim Platformu ("Platform Sağlayıcı / WorksAuto") ile sisteme üye olan, lisans alan veya yönetim panelini kullanan Oto Servis / Ekspertiz İşletmesi ("İşletme / Müşteri") arasında akdedilmiştir. Sözleşmenin amacı; İşletme'ye sunulan bulut tabanlı servis yönetim yazılımının kullanım şartlarını, tarafların 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve ilgili mevzuat kapsamındaki hak ve yükümlülüklerini belirlemektir.

2. HİZMETİN KAPSAMI VE LİSANS TAAHHÜDÜ
WorksAuto; oto servislerine randevu planlama, atölye iş emirleri, teknisyen ve lift yönetimi, 2D depo ve raf matrisi, yedek parça ve atomik stok takibi, çift taraflı cari hesap mutabakatı, e-fatura/arşiv hazırlığı ve çok kanallı bildirim (WhatsApp, E-Posta, SMS) altyapısı sağlayan çok kiracılı (multi-tenant) bir SaaS platformudur. İşletme, seçtiği lisans paketi süresince platformu münhasır olmayan şekilde kullanma hakkına sahiptir.

3. 6698 SAYILI KVKK VE VERİ İŞLEYEN PROTOKOLÜ
3.1. Rollerin Belirlenmesi: İşletme; platforma kaydettiği araç sahiplerine, tedarikçilere ve personeline ait kişisel veriler (ad, soyad, telefon, TCKN/VKN, plaka, şasi no, servis geçmişi, cari bakiye vb.) bakımından 6698 sayılı Kanun kapsamında münhasıran "VERİ SORUMLUSU" sıfatını haizdir. WorksAuto ise bu verileri yalnızca İşletme'nin talimatları ve yazılım hizmetinin gereklilikleri doğrultusunda işleyen "VERİ İŞLEYEN" konumundadır.
3.2. Aydınlatma ve Rıza Yükümlülüğü: İşletme; araç sahiplerinden gerekli açık rızaları aldığını, 6698 sayılı Kanun'un 10. maddesi uyarınca aydınlatma yükümlülüğünü yerine getirdiğini ve İYS (İleti Yönetim Sistemi) düzenlemelerine uygun hareket ettiğini gayrikabili rücu kabul ve taahhüt eder.
3.3. Unutulma Hakkı (Anonimleştirme): Araç sahiplerinin kişisel verilerinin silinmesi veya anonimleştirilmesi talepleri doğrudan Veri Sorumlusu olan İşletme tarafından platform üzerinden yürütülür.

4. MÜŞTERİ İLETİŞİMİ VE ÇOK KANALLI BİLDİRİM (WHATSAPP, E-POSTA, SMS)
4.1. İşletme; araç kabul formu, ek parça onay talebi, ekspertiz fotoğrafları, hazır araç teslim bildirimi ve fatura bilgilendirmelerini müşterilerine iletmek üzere platformun sunduğu çok kanallı (WhatsApp, E-Posta, SMS) iletişim motorunu kullanır.
4.2. Gönderilen ticari iletilerin içeriğinden, onay mekanizmasından ve alıcıların iletişim bilgilerinin doğruluğundan doğrudan İşletme sorumludur.

5. VERİ İZOLASYONU, TİCARİ SIRLAR VE ROW-LEVEL SECURITY (RLS) GÜVENCESİ
5.1. WorksAuto; İşletme'nin müşteri portföyünü, maliyetlerini, kârlılık oranlarını ve ticari sırlarını en üst seviyede korumayı taahhüt eder.
5.2. Platform mimarisinde PostgreSQL Native Row-Level Security (RLS) ve kriptografik oturum izolasyonu uygulanmakta olup, bir işletmenin verilerine diğer hiçbir işletmenin veya yetkisiz personelin erişmesi fiziksel ve yazılımsal olarak engellenmiştir.

6. MALİ MEVZUAT VE VERGİ USUL KANUNU (VUK) UYUMU
6.1. Platform üzerinden oluşturulan iş emirleri, parça sarfiyatları, faturalar ve tahsilat makbuzları muhasebe ön kaydı niteliğindedir.
6.2. Yasal defter ve beyannamelerin doğruluğu, KDV oranları ve resmi e-fatura/e-arşiv süreçlerinin mevzuata uygunluğu İşletme'nin ve yetkili mali müşavirinin sorumluluğundadır.

7. HİZMET KESİNTİSİZLİĞİ VE YEDEKLEME (SLA)
WorksAuto; bulut altyapısının %99.5 erişilebilirlik (uptime) standardında çalışmasını ve verilerin periyodik olarak güvenli yedekleme ortamlarında saklanmasını taahhüt eder. Mücbir sebepler ve planlı bakım çalışmaları İşletme'ye önceden bildirilir.

8. ELEKTRONİK DELİL NİTELİĞİ VE YÜRÜRLÜK
İşbu sözleşme; İşletme yetkilisinin dijital ortamda onay kutularını işaretleyerek "Sözleşmeyi Onayla ve Sistemi Aktif Et" butonuna tıklaması ile yürürlüğe girer. Taraflar; onay anında sunucu tarafından üretilen zaman damgası, IP adresi, imzalayan kullanıcı bilgileri ve sözleşme metninin SHA-256 kriptografik özetinin, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun (HMK) 193. maddesi uyarınca taraflar arasında bağlayıcı "münhasır delil sözleşmesi" niteliğinde olduğunu kabul eder.
`.trim();

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Güncel B2B sözleşme metnini ve versiyonunu döner
   */
  getContractDetails() {
    const textHash = crypto
      .createHash('sha256')
      .update(B2B_CONTRACT_TEXT)
      .digest('hex');

    return {
      version: CURRENT_B2B_CONTRACT_VERSION,
      contractText: B2B_CONTRACT_TEXT,
      payloadHash: textHash,
      updatedAt: '2026-09-11',
    };
  }

  /**
   * İşletmenin B2B sözleşme durumunu döner
   */
  async getTenantConsentStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        title: true,
        b2bConsentAccepted: true,
        b2bConsentAcceptedAt: true,
        b2bContractVersion: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('İşletme bulunamadı.');
    }

    const latestConsent = await this.prisma.tenantConsent.findFirst({
      where: { tenantId },
      orderBy: { signedAt: 'desc' },
      include: {
        signedByUser: {
          select: { id: true, name: true, surname: true, phone: true },
        },
      },
    });

    return {
      isAccepted: tenant.b2bConsentAccepted,
      acceptedAt: tenant.b2bConsentAcceptedAt,
      version: tenant.b2bContractVersion,
      currentPlatformContractVersion: CURRENT_B2B_CONTRACT_VERSION,
      latestConsent,
    };
  }

  /**
   * İşletme yetkilisinin B2B sözleşmesini dijital olarak mühürler
   */
  async signB2bConsent(
    tenantId: string,
    userId: string,
    dto: SignB2bConsentDto,
    meta: { ip: string; userAgent: string },
  ) {
    if (!dto.saasTermsAccepted || !dto.dataProcessingAccepted) {
      throw new BadRequestException(
        'Sistemi kullanabilmek için WorksAuto B2B SaaS Sözleşmesi ve KVKK Veri İşleme Protokolü zorunlu olarak onaylanmalıdır.',
      );
    }

    const textHash = crypto
      .createHash('sha256')
      .update(B2B_CONTRACT_TEXT)
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      // 1. Audit kaydını oluştur
      const consentRecord = await tx.tenantConsent.create({
        data: {
          tenantId,
          signedByUserId: userId,
          contractVersion: CURRENT_B2B_CONTRACT_VERSION,
          ipAddress: meta.ip || '127.0.0.1',
          userAgent: meta.userAgent || 'Unknown Client',
          verifiedVia: 'WEB_DIGITAL_SIGNATURE',
          payloadHash: textHash,
          saasTermsAccepted: dto.saasTermsAccepted,
          dataProcessingAccepted: dto.dataProcessingAccepted,
          marketingAccepted: dto.marketingAccepted || false,
          signedAt: new Date(),
        },
      });

      // 2. Tenant kaydını onayla
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          b2bConsentAccepted: true,
          b2bConsentAcceptedAt: new Date(),
          b2bContractVersion: CURRENT_B2B_CONTRACT_VERSION,
        },
      });

      this.logger.log(
        `📜 [B2B KVKK ONAYLANDI] Servis: ${updatedTenant.title} (${tenantId}) | İmzalayan: ${userId} | IP: ${meta.ip}`,
      );

      return {
        success: true,
        message:
          'WorksAuto B2B Hizmet Şartları ve KVKK Sözleşmesi başarıyla onaylandı. Sistem erişiminiz aktif edildi.',
        tenant: {
          id: updatedTenant.id,
          title: updatedTenant.title,
          b2bConsentAccepted: updatedTenant.b2bConsentAccepted,
          b2bConsentAcceptedAt: updatedTenant.b2bConsentAcceptedAt,
        },
        consent: consentRecord,
      };
    });
  }
}
