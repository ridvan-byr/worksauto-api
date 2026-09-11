export const CUSTOMER_CONSENT_REPOSITORY = 'ICustomerConsentRepository';

export interface CreateConsentInput {
  tenantId: string;
  customerId: string;
  consentType: string;
  isGranted: boolean;
  channel: string;
  verificationToken?: string | null;
  expiresAt?: Date | null;
  policyVersion?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  grantedAt?: Date;
}

export interface ICustomerConsentRepository {
  findCustomerWithTenant(
    tenantId: string,
    customerId: string,
  ): Promise<any | null>;
  findCustomerConsents(tenantId: string, customerId: string): Promise<any[]>;
  createConsent(data: CreateConsentInput): Promise<any>;
  findConsentByToken(token: string): Promise<any | null>;
  findConsentByTokenWithRelations(token: string): Promise<any | null>;
  confirmConsentWithAudit(
    consentId: string,
    commercialSms: boolean,
    auditData: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ grantedAt: Date }>;
  recordDirectConsent(
    tenantId: string,
    customerId: string,
    channel: string,
    policyVersion: string,
    commercialSms?: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<any>;
  logAudit(data: any): Promise<void>;
}
