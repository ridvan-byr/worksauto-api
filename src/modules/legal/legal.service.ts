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
# WORKSAUTO KURUMSAL BULUT HİZMET SÖZLEŞMESİ, KVKK VERİ İŞLEME VE TİCARİ İLETİ PROTOKOLÜ
(Resmi B2B Lisans ve Yasal Uyum Metni - Sürüm 1.0)

MADDE 1 – TARAFLAR VE SÖZLEŞMENİN AMACI
İşbu Sözleşme; bulut tabanlı servis yönetim altyapısını sağlayan "WorksAuto" (Platform Sağlayıcı) ile sistemi kullanarak oto servis ve eksper faaliyetlerini yürüten ticari işletme ("İşletme / Müşteri") arasında akdedilmiştir. Sözleşmenin amacı; İşletme'nin WorksAuto yazılımını güvenli, kesintisiz ve mevzuata uygun biçimde kullanmasını sağlamak, tarafların karşılıklı yasal hak ve yükümlülüklerini belirlemektir.

MADDE 2 – SUNULAN HİZMETİN KAPSAMI
WorksAuto; oto servislerinin tüm operasyonel süreçlerini dijital ortamda yönetebilmesi için randevu takibi, atölye iş emirleri, usta ve lift planlaması, yedek parça ve depo stok takibi, müşteri cari hesap mutabakatı, resmi fatura ön hazırlığı ve çok kanallı bilgilendirme (WhatsApp, SMS, E-Posta) imkânı sunan kurumsal bir bulut yönetim yazılımıdır. İşletme, seçtiği lisans paketi süresince sistemi işletme faaliyetleri kapsamında münhasır olmayan bir hakla kullanır.

MADDE 3 – 6698 SAYILI KVKK KAPSAMINDA TARAFLARIN ROLLERİ VE TAAHHÜTLER
6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca tarafların görev ve yasal sorumlulukları şu şekildedir:
3.1. İşletme (Veri Sorumlusu): Servise başvuran araç sahiplerine ait kişisel bilgilerin (ad, soyad, telefon, plaka, şasi numarası, arıza geçmişi ve fatura detayları) münhasıran yasal sahibidir. İşletme; müşterilerine gerekli KVKK aydınlatmasını yaptığını ve mevzuatın öngördüğü izinleri aldığını kabul ve taahhüt eder.
3.2. WorksAuto (Veri İşleyen): İşletme tarafından sisteme kaydedilen verileri yalnızca yazılımın işletilmesi ve servis hizmetlerinin yerine getirilmesi amacıyla, İşletme'nin talimatları doğrultusunda güvenli sunucularda barındırır ve işler. WorksAuto bu verileri asla üçüncü kişilere satamaz, ticari amaçla paylaşamaz veya kendi adına kullanamaz.
3.3. Müşteri Talepleri (Veri Silme ve Anonimleştirme): Araç sahiplerinin bilgilerinin silinmesi veya anonim hale getirilmesi yönündeki talepleri doğrudan veri sorumlusu olan İşletme tarafından sistem üzerinden yönetilir.

MADDE 4 – 6563 SAYILI KANUN KAPSAMINDA TİCARİ ELEKTRONİK İLETİ İZNİ VE İLETİŞİM ESASLARI
4.1. İşletmenin Kendi Müşterilerine Gönderdiği Bildirimler: İşletme; araç kabul formu, ek parça onay talebi, araç teslimata hazır bildirimi ve fatura detaylarını sistem aracılığıyla müşterilerine iletebilir. Gönderilen bu operasyonel mesajların doğruluğundan, içeriğinden ve alıcı izinlerinden doğrudan İşletme sorumludur.
4.2. WorksAuto Tarafından İşletmeye Yapılacak Ticari Elektronik İletiler: İşletme yetkilisinin onay vermesi halinde WorksAuto; sistem yenilikleri, yeni modüller, güvenlik ve sürüm güncellemeleri, teknik eğitimler, sektörel kampanyalar ve avantajlı iş ortaklığı teklifleri hakkında İşletme'ye WhatsApp, SMS ve E-Posta aracılığıyla ticari elektronik ileti gönderebilir.
4.3. Ret ve Vazgeçme Hakkı: İşletme, WorksAuto'dan ticari elektronik ileti alma tercihini dilediği zaman sistem ayarlarından veya gelen mesajlardaki yönlendirmeleri kullanarak hiçbir gerekçe göstermeksizin ve tamamen ücretsiz olarak iptal etme (ret) hakkına sahiptir.

MADDE 5 – TİCARİ SIRLARIN GİZLİLİĞİ VE BİLGİ GÜVENLİĞİ
5.1. İşletme'ye ait müşteri portföyü, yedek parça alış maliyetleri, uygulanan iskonto ve kâr marjları ile ciro bilgileri "Ticari Sır" niteliğindedir.
5.2. WorksAuto; işletmeler arası bağımsız ve tam yalıtılmış veri güvenliği standardı uygular. Her işletmenin verisi yalnızca kendine özel güvenli alanda tutulur; bir servisin verilerinin başka bir servis veya yetkisiz personel tarafından görüntülenmesi teknik olarak engellenmiştir.

MADDE 6 – MALİ MEVZUAT VE VERGİ USUL KANUNU (VUK) SORUMLULUKLARI
Platform üzerinden oluşturulan iş emirleri, malzeme sarfiyatları, cari hesap hareketleri, tahsilat makbuzları ve fatura taslakları ön muhasebe niteliğindedir. Bu kayıtların resmi defterlere işlenmesi, yasal KDV oranlarının doğruluğu ve resmi e-fatura/e-arşiv süreçlerinin mevzuata uygun yürütülmesi İşletme'nin ve yetkili mali müşavirinin sorumluluğundadır.

MADDE 7 – SİSTEM KESİNTİSİZLİĞİ VE OTOMATİK VERİ YEDEKLEME
WorksAuto; oto servis operasyonlarının aksamaması için bulut altyapısının kesintisiz (%99.5 erişilebilirlik standardında) çalışmasını ve olası teknik aksaklıklara karşı periyodik güvenli veri yedeklemesi yapılmasını taahhüt eder. Planlı bakım çalışmaları İşletme'ye önceden bildirilir.

MADDE 8 – DİJİTAL ONAY VE ELEKTRONİK DELİL PROTOKOLÜ (6100 S. HMK MD. 193)
İşbu sözleşme; İşletme yetkilisinin dijital ortamda ilgili onayları işaretlemesi ve onay butonuna tıklaması ile taraflar arasında resmen akdedilmiş ve yürürlüğe girmiş sayılır. Onay anında sistem tarafından kayıt altına alınan IP adresi, işlem zamanı (tarih/saat damgası) ve elektronik güvenlik kayıtları, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun 193. maddesi uyarınca taraflar arasında bağlayıcı ve kesin delil niteliğindedir.
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
   * İşletmenin 6563 sayılı Kanun kapsamındaki ticari elektronik ileti iznini günceller (ret / kabul)
   */
  async updateMarketingConsent(tenantId: string, marketingAccepted: boolean) {
    const latestConsent = await this.prisma.tenantConsent.findFirst({
      where: { tenantId },
      orderBy: { signedAt: 'desc' },
    });

    if (latestConsent) {
      await this.prisma.tenantConsent.update({
        where: { id: latestConsent.id },
        data: { marketingAccepted },
      });
    }

    this.logger.log(
      `📢 [TİCARİ İLETİ İZNİ GÜNCELLENDİ] İşletme: ${tenantId} | İzin: ${marketingAccepted ? 'AÇIK (KABUL)' : 'KAPALI (RET)'}`,
    );

    return {
      success: true,
      marketingAccepted,
      message: marketingAccepted
        ? 'Ticari elektronik ileti izniniz aktif edildi.'
        : 'Ticari elektronik ileti izniniz iptal edildi. Ret talebiniz sisteme işlendi.',
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
