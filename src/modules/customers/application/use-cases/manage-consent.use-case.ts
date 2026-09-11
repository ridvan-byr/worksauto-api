import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CUSTOMER_CONSENT_REPOSITORY,
  ICustomerConsentRepository,
} from '../../domain/customer-consent.repository.interface';
import { ConfirmConsentDto, DirectConsentDto } from '../../dto/consent.dto';

@Injectable()
export class ManageConsentUseCase {
  constructor(
    @Inject(CUSTOMER_CONSENT_REPOSITORY)
    private readonly consentRepository: ICustomerConsentRepository,
  ) {}

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 2);
  }

  async getConsents(tenantId: string, customerId: string) {
    const customer = await this.consentRepository.findCustomerWithTenant(
      tenantId,
      customerId,
    );

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const records = await this.consentRepository.findCustomerConsents(
      tenantId,
      customerId,
    );

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
    const customer = await this.consentRepository.findCustomerWithTenant(
      tenantId,
      customerId,
    );

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gün geçerli

    await this.consentRepository.createConsent({
      tenantId,
      customerId,
      consentType: 'KVKK_AYDINLATMA',
      isGranted: false, // Onay bekliyor
      channel: 'SMS_LINK',
      verificationToken: token,
      expiresAt,
      policyVersion: '1.0',
    });

    const verificationPath = `/c/kvkk?token=${token}`;

    await this.consentRepository.logAudit({
      tenantId,
      action: 'customer.consent_sms_sent',
      entityName: 'Customer',
      entityId: customer.id,
      changesAfter: {
        customerName: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        phone: customer.phone,
        verificationPath,
      },
    });

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
    const consent =
      await this.consentRepository.findConsentByTokenWithRelations(token);

    if (!consent) {
      throw new NotFoundException(
        'Geçersiz veya süresi dolmuş onay bağlantısı.',
      );
    }

    if (consent.expiresAt && consent.expiresAt < new Date()) {
      throw new BadRequestException(
        'Bu onay bağlantısının süresi dolmuştur. Lütfen servisten yeni link talep ediniz.',
      );
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

  async confirmConsent(
    token: string,
    dto: ConfirmConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consent =
      await this.consentRepository.findConsentByTokenWithRelations(token);

    if (!consent) {
      throw new NotFoundException('Geçersiz onay bağlantısı.');
    }

    if (consent.expiresAt && consent.expiresAt < new Date()) {
      throw new BadRequestException(
        'Bu onay bağlantısının geçerlilik süresi dolmuştur.',
      );
    }

    const auditData = {
      customerName:
        `${consent.customer.firstName} ${consent.customer.lastName || ''}`.trim(),
      channel: 'SMS_LINK',
      commercialSms: Boolean(dto.commercialSms),
    };

    const { grantedAt } = await this.consentRepository.confirmConsentWithAudit(
      consent.id,
      Boolean(dto.commercialSms),
      auditData,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      message: 'KVKK ve İYS onayınız başarıyla mühürlendi ve kaydedildi.',
      grantedAt,
    };
  }

  async recordDirectConsent(
    tenantId: string,
    customerId: string,
    dto: DirectConsentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const customer = await this.consentRepository.findCustomerWithTenant(
      tenantId,
      customerId,
    );

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    return this.consentRepository.recordDirectConsent(
      tenantId,
      customerId,
      dto.channel,
      dto.policyVersion || '1.0',
      Boolean(dto.commercialSms),
      ipAddress,
      userAgent,
    );
  }
}
