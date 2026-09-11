import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManageConsentUseCase } from './manage-consent.use-case';
import { ICustomerConsentRepository } from '../../domain/customer-consent.repository.interface';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ManageConsentUseCase', () => {
  let useCase: ManageConsentUseCase;
  let mockConsentRepo: ICustomerConsentRepository;

  beforeEach(() => {
    mockConsentRepo = {
      findCustomerWithTenant: vi.fn(),
      findCustomerConsents: vi.fn(),
      createConsent: vi.fn(),
      findConsentByToken: vi.fn(),
      findConsentByTokenWithRelations: vi.fn(),
      confirmConsentWithAudit: vi.fn(),
      recordDirectConsent: vi.fn(),
      logAudit: vi.fn(),
    };

    useCase = new ManageConsentUseCase(mockConsentRepo);
  });

  describe('getConsents', () => {
    it('should throw NotFoundException if customer not found', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue(null);

      await expect(useCase.getConsents('t-1', 'cust-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return consent status and history when customer exists', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue({
        id: 'cust-1',
        tenantId: 't-1',
      });
      vi.mocked(mockConsentRepo.findCustomerConsents).mockResolvedValue([
        {
          id: 'consent-1',
          consentType: 'KVKK_AYDINLATMA',
          isGranted: true,
          revokedAt: null,
          grantedAt: new Date(),
          channel: 'SMS_LINK',
        },
      ]);

      const result = await useCase.getConsents('t-1', 'cust-1');

      expect(result.customerId).toBe('cust-1');
      expect(result.isKvkkApproved).toBe(true);
      expect(result.isCommercialSmsApproved).toBe(false);
      expect(result.history).toHaveLength(1);
    });
  });

  describe('sendConsentSms', () => {
    it('should throw NotFoundException if customer not found', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue(null);

      await expect(useCase.sendConsentSms('t-1', 'cust-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create pending consent token and return verification URL', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue({
        id: 'cust-1',
        firstName: 'Ali',
        lastName: 'Yılmaz',
        phone: '05551234567',
        tenant: { title: 'Auto Servis' },
      });
      vi.mocked(mockConsentRepo.createConsent).mockResolvedValue({ id: 'c-1' });

      const result = await useCase.sendConsentSms('t-1', 'cust-1');

      expect(result.success).toBe(true);
      expect(result.customerPhone).toBe('05551234567');
      expect(result.verificationUrl).toContain('/c/kvkk?token=');
      expect(mockConsentRepo.createConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          customerId: 'cust-1',
          consentType: 'KVKK_AYDINLATMA',
          isGranted: false,
          channel: 'SMS_LINK',
        }),
      );
    });
  });

  describe('verifyToken', () => {
    it('should throw NotFoundException if token is invalid', async () => {
      vi.mocked(
        mockConsentRepo.findConsentByTokenWithRelations,
      ).mockResolvedValue(null);

      await expect(useCase.verifyToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if token has expired', async () => {
      vi.mocked(
        mockConsentRepo.findConsentByTokenWithRelations,
      ).mockResolvedValue({
        id: 'c-1',
        expiresAt: new Date(Date.now() - 10000), // expired
      });

      await expect(useCase.verifyToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return token details if valid', async () => {
      vi.mocked(
        mockConsentRepo.findConsentByTokenWithRelations,
      ).mockResolvedValue({
        id: 'c-1',
        isGranted: false,
        grantedAt: null,
        policyVersion: '1.0',
        expiresAt: new Date(Date.now() + 100000),
        customer: {
          id: 'cust-1',
          firstName: 'Ali',
          lastName: 'Yılmaz',
          phone: '05551234567',
        },
        tenant: { id: 't-1', title: 'Auto Servis' },
      });

      const result = await useCase.verifyToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.alreadyGranted).toBe(false);
      expect(result.customer.phoneMasked).toContain('****');
    });
  });

  describe('confirmConsent', () => {
    it('should throw NotFoundException if token is not found', async () => {
      vi.mocked(
        mockConsentRepo.findConsentByTokenWithRelations,
      ).mockResolvedValue(null);

      await expect(
        useCase.confirmConsent('invalid', { commercialSms: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should confirm consent and return success', async () => {
      const grantedAt = new Date();
      vi.mocked(
        mockConsentRepo.findConsentByTokenWithRelations,
      ).mockResolvedValue({
        id: 'c-1',
        customer: { firstName: 'Ali', lastName: 'Yılmaz' },
        expiresAt: new Date(Date.now() + 100000),
      });
      vi.mocked(mockConsentRepo.confirmConsentWithAudit).mockResolvedValue({
        grantedAt,
      });

      const result = await useCase.confirmConsent('valid', {
        commercialSms: true,
      });

      expect(result.success).toBe(true);
      expect(result.grantedAt).toBe(grantedAt);
      expect(mockConsentRepo.confirmConsentWithAudit).toHaveBeenCalledWith(
        'c-1',
        true,
        expect.any(Object),
        undefined,
        undefined,
      );
    });
  });

  describe('recordDirectConsent', () => {
    it('should throw NotFoundException if customer does not exist', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue(null);

      await expect(
        useCase.recordDirectConsent('t-1', 'cust-1', {
          channel: 'TABLET_SIGN',
          commercialSms: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should record direct consent', async () => {
      vi.mocked(mockConsentRepo.findCustomerWithTenant).mockResolvedValue({
        id: 'cust-1',
      });
      vi.mocked(mockConsentRepo.recordDirectConsent).mockResolvedValue({
        id: 'consent-1',
      });

      const result = await useCase.recordDirectConsent('t-1', 'cust-1', {
        channel: 'TABLET_SIGN',
        commercialSms: true,
      });

      expect(result.id).toBe('consent-1');
      expect(mockConsentRepo.recordDirectConsent).toHaveBeenCalledWith(
        't-1',
        'cust-1',
        'TABLET_SIGN',
        '1.0',
        true,
        undefined,
        undefined,
      );
    });
  });
});
