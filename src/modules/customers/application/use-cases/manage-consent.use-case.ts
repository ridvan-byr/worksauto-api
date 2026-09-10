import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ConfirmConsentDto, DirectConsentDto } from '../../dto/consent.dto';

@Injectable()
export class ManageConsentUseCase {
  private readonly logger = new Logger(ManageConsentUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 2);
  }

  async getConsents(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const records = await this.prisma.customerConsent.findMany({
      where: { tenantId, customerId },
      orderBy: { grantedAt: 'desc' },
    });

    const activeKvkk = records.find(
      (r) => r.consentType === 'KVKK_AYDINLATMA' && r.isGranted && !r.revokedAt,
    );
    const activeSms = records.find(
      (r) => r.consentType === 'COMMERCIAL_SMS' && r.isGranted && !r.revokedAt,
    );

    return {
      customerId,
      isKvkkApproved: Boolean(activeKvkk),
      isCommercialSmsApproved: Boolean(activeSms),
      latestConsentDate: activeKvkk?.grantedAt || null,
      latestChannel: activeKvkk?.channel || null,
      history: records,
    };
  }

  async sendConsentSms(tenantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: { tenant: { select: { title: true } } },
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gün geçerli

    await this.prisma.customerConsent.create({
      data: {
        tenantId,
        customerId,
        consentType: 'KVKK_AYDINLATMA',
        isGranted: false, // Onay bekliyor
        channel: 'SMS_LINK',
        verificationToken: token,
        expiresAt,
        policyVersion: '1.0',
      },
    });

    const verificationPath = `/c/kvkk?token=${token}`;

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: 'customer.consent_sms_sent',
          entityName: 'Customer',
          entityId: customer.id,
          changesAfter: {
            customerName: `${customer.firstName} ${customer.lastName || ''}`.trim(),
            phone: customer.phone,
            verificationPath,
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log failed: ${e}`);
    }

    return {
      success: true,
      message: 'Müşteri onay linki oluşturuldu ve hazırlandı.',
      verificationToken: token,
      verificationUrl: verificationPath,
      customerPhone: customer.phone,
      tenantTitle: customer.tenant.title,
    };
  }

  async verifyToken(token: string) {
    const consent = await this.prisma.customerConsent.findUnique({
      where: { verificationToken: token },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        tenant: { select: { id: true, title: true, phone: true, email: true, address: true, city: true } },
      },
    });

    if (!consent) {
      throw new NotFoundException('Geçersiz veya süresi dolmuş onay bağlantısı.');
    }

    if (consent.expiresAt && consent.expiresAt < new Date()) {
      throw new BadRequestException('Bu onay bağlantısının süresi dolmuştur. Lütfen servisten yeni link talep ediniz.');
    }

    return {
      valid: true,
      alreadyGranted: consent.isGranted,
      grantedAt: consent.grantedAt,
      policyVersion: consent.policyVersion,
      tenant: consent.tenant,
      customer: {
        id: consent.customer.id,
        name: `${consent.customer.firstName} ${consent.customer.lastName || ''}`.trim(),
        phoneMasked: this.maskPhone(consent.customer.phone),
      },
    };
  }

  async confirmConsent(token: string, dto: ConfirmConsentDto, ipAddress?: string, userAgent?: string) {
    const consent = await this.prisma.customerConsent.findUnique({
      where: { verificationToken: token },
      include: { customer: true, tenant: true },
    });

    if (!consent) {
      throw new NotFoundException('Geçersiz onay bağlantısı.');
    }

    if (consent.expiresAt && consent.expiresAt < new Date()) {
      throw new BadRequestException('Bu onay bağlantısının geçerlilik süresi dolmuştur.');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. KVKK Aydınlatma Kaydını Onayla
      await tx.customerConsent.update({
        where: { id: consent.id },
        data: {
          isGranted: true,
          grantedAt: now,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // 2. Ticari SMS Onayı Seçilmişse Ek Kayıt Oluştur
      if (dto.commercialSms) {
        await tx.customerConsent.create({
          data: {
            tenantId: consent.tenantId,
            customerId: consent.customerId,
            consentType: 'COMMERCIAL_SMS',
            isGranted: true,
            grantedAt: now,
            channel: 'SMS_LINK',
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            policyVersion: consent.policyVersion,
          },
        });
      }

      // 3. Güvenlik Denetim İzi Kaydı
      try {
        await tx.auditLog.create({
          data: {
            tenantId: consent.tenantId,
            action: 'customer.kvkk_consent_granted',
            entityName: 'CustomerConsent',
            entityId: consent.id,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            changesAfter: {
              customerName: `${consent.customer.firstName} ${consent.customer.lastName || ''}`.trim(),
              channel: 'SMS_LINK',
              commercialSms: Boolean(dto.commercialSms),
              timestamp: now.toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Audit log failed: ${e}`);
      }

      return {
        success: true,
        message: 'KVKK ve İYS onayınız başarıyla mühürlendi ve kaydedildi.',
        grantedAt: now,
      };
    });
  }

  async recordDirectConsent(
    tenantId: string,
    customerId: string,
    dto: DirectConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const consent = await tx.customerConsent.create({
        data: {
          tenantId,
          customerId,
          consentType: 'KVKK_AYDINLATMA',
          isGranted: true,
          grantedAt: now,
          channel: dto.channel,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          policyVersion: dto.policyVersion || '1.0',
        },
      });

      if (dto.commercialSms) {
        await tx.customerConsent.create({
          data: {
            tenantId,
            customerId,
            consentType: 'COMMERCIAL_SMS',
            isGranted: true,
            grantedAt: now,
            channel: dto.channel,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            policyVersion: dto.policyVersion || '1.0',
          },
        });
      }

      return consent;
    });
  }
}
