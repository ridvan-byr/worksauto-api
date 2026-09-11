import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  ICustomerConsentRepository,
  CreateConsentInput,
} from '../domain/customer-consent.repository.interface';

@Injectable()
export class PrismaCustomerConsentRepository implements ICustomerConsentRepository {
  private readonly logger = new Logger(PrismaCustomerConsentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findCustomerWithTenant(
    tenantId: string,
    customerId: string,
  ): Promise<any | null> {
    return this.prisma.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
      include: { tenant: { select: { title: true } } },
    });
  }

  async findCustomerConsents(
    tenantId: string,
    customerId: string,
  ): Promise<any[]> {
    return this.prisma.customerConsent.findMany({
      where: { tenantId, customerId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async createConsent(data: CreateConsentInput): Promise<any> {
    return this.prisma.customerConsent.create({
      data: {
        tenantId: data.tenantId,
        customerId: data.customerId,
        consentType: data.consentType,
        isGranted: data.isGranted,
        channel: data.channel,
        verificationToken: data.verificationToken,
        expiresAt: data.expiresAt,
        policyVersion: data.policyVersion || '1.0',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        grantedAt: data.grantedAt,
      },
    });
  }

  async findConsentByToken(token: string): Promise<any | null> {
    return this.prisma.customerConsent.findUnique({
      where: { verificationToken: token },
    });
  }

  async findConsentByTokenWithRelations(token: string): Promise<any | null> {
    return this.prisma.customerConsent.findUnique({
      where: { verificationToken: token },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        tenant: {
          select: {
            id: true,
            title: true,
            phone: true,
            email: true,
            address: true,
            city: true,
          },
        },
      },
    });
  }

  async confirmConsentWithAudit(
    consentId: string,
    commercialSms: boolean,
    auditData: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ grantedAt: Date }> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerConsent.update({
        where: { id: consentId },
        data: {
          isGranted: true,
          grantedAt: now,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      if (commercialSms) {
        await tx.customerConsent.create({
          data: {
            tenantId: updated.tenantId,
            customerId: updated.customerId,
            consentType: 'COMMERCIAL_SMS',
            isGranted: true,
            grantedAt: now,
            channel: 'SMS_LINK',
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            policyVersion: updated.policyVersion,
          },
        });
      }

      if (auditData) {
        try {
          await tx.auditLog.create({
            data: {
              tenantId: updated.tenantId,
              action: 'customer.kvkk_consent_granted',
              entityName: 'CustomerConsent',
              entityId: updated.id,
              ipAddress: ipAddress || null,
              userAgent: userAgent || null,
              changesAfter: {
                ...auditData,
                timestamp: now.toISOString(),
              },
            },
          });
        } catch (e) {
          this.logger.warn(`Audit log failed: ${e}`);
        }
      }

      return { grantedAt: now };
    });
  }

  async recordDirectConsent(
    tenantId: string,
    customerId: string,
    channel: string,
    policyVersion: string,
    commercialSms?: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const consent = await tx.customerConsent.create({
        data: {
          tenantId,
          customerId,
          consentType: 'KVKK_AYDINLATMA',
          isGranted: true,
          grantedAt: now,
          channel,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          policyVersion: policyVersion || '1.0',
        },
      });

      if (commercialSms) {
        await tx.customerConsent.create({
          data: {
            tenantId,
            customerId,
            consentType: 'COMMERCIAL_SMS',
            isGranted: true,
            grantedAt: now,
            channel,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
            policyVersion: policyVersion || '1.0',
          },
        });
      }

      return consent;
    });
  }

  async logAudit(data: any): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data });
    } catch (e) {
      this.logger.warn(`Audit log failed: ${e}`);
    }
  }
}
