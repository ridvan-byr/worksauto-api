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
(Sürüm: 1.0 - 2026)

1. TARAFLAR VE AMAÇ
İşbu sözleşme; WorksAuto Bulut Servis Yönetim Platformu ("Platform Sağlayıcı") ile Platform'a kayıt olan ve lisans alan Oto Servis İşletmesi ("İşletme / Veri Sorumlusu") arasında akdedilmiştir.

2. HİZMETİN KAPSAMI
WorksAuto; oto servislerine randevu planlama, iş emri takibi, yedek parça ve stok yönetimi, dijital fatura, cari hesap takibi ve çok kanallı bildirim (WhatsApp, E-Posta, SMS) altyapısı sunan çok kiracılı (multi-tenant) bir SaaS yazılımıdır.

3. 6698 SAYILI KVKK KAPSAMINDA SORUMLULUKLAR
3.1. İşletme (Oto Servisi); platforma kaydettiği araç sahiplerine ait kişisel veriler (ad, soyad, telefon, plaka, şasi no, cari hareketler) bakımından 6698 sayılı Kanun uyarınca münhasıran "VERİ SORUMLUSU" sıfatını haizdir.
3.2. WorksAuto; söz konusu verileri yalnızca İşletme'nin talimatları ve SaaS hizmetinin ifası doğrultusunda işleyen "VERİ İŞLEYEN" konumundadır.
3.3. İşletme; araç sahiplerine yönelik aydınlatma yükümlülüğünü yerine getirdiğini, gerekli hallerde açık rıza aldığını taahhüt eder.

4. BİLGİ GÜVENLİĞİ VE İZOLASYON
WorksAuto; işletmenin ticari sırlarını, müşteri portföyünü ve stok maliyetlerini PostgreSQL Row-Level Security (RLS) ve kriptografik oturum mimarisi ile diğer tüm işletmelerden fiziksel olarak izole etmeyi taahhüt eder.

5. ELEKTRONİK ONAY VE DELİL NİTELİĞİ
İşbu sözleşmenin dijital ortamda zaman damgası, IP adresi ve kriptografik hash özetiyle onaylanması, 6100 sayılı Hukuk Muhakemeleri Kanunu uyarınca kesin delil niteliğindedir.
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
