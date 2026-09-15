import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StaffService } from './staff.service';
import { LeaveType, LeaveStatus, UserRole } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('StaffService - Leaves & Audit Logs', () => {
  let service: StaffService;
  let mockPrisma: any;
  let mockAudit: any;

  const mockTenantId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockLeaveId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      mechanic: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      staffLeave: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        findMany: vi.fn(),
      },
      workOrder: { count: vi.fn() },
      appointment: { count: vi.fn() },
      $transaction: vi.fn((cb) => cb(mockPrisma)),
    };

    mockAudit = {
      log: vi.fn().mockResolvedValue(null),
    };

    service = new StaffService(mockPrisma as any, mockAudit as any);
  });

  describe('getLeaves', () => {
    it('returns leaves for tenant', async () => {
      const mockLeaves = [
        { id: mockLeaveId, tenantId: mockTenantId, userId: mockUserId, leaveType: LeaveType.ANNUAL },
      ];
      mockPrisma.staffLeave.findMany.mockResolvedValue(mockLeaves);

      const result = await service.getLeaves(mockTenantId);
      expect(result).toEqual(mockLeaves);
      expect(mockPrisma.staffLeave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: mockTenantId },
        }),
      );
    });

    it('filters by userId when provided', async () => {
      mockPrisma.staffLeave.findMany.mockResolvedValue([]);
      await service.getLeaves(mockTenantId, mockUserId);
      expect(mockPrisma.staffLeave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: mockTenantId, userId: mockUserId },
        }),
      );
    });
  });

  describe('createLeave', () => {
    it('throws NotFoundException if user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.createLeave(mockTenantId, {
          userId: mockUserId,
          leaveType: LeaveType.ANNUAL,
          startDate: '2026-09-20',
          endDate: '2026-09-25',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if start date > end date', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: mockUserId, name: 'Ali', surname: 'Usta' });

      await expect(
        service.createLeave(mockTenantId, {
          userId: mockUserId,
          leaveType: LeaveType.ANNUAL,
          startDate: '2026-09-25',
          endDate: '2026-09-20',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if there is overlapping leave', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: mockUserId, name: 'Ali', surname: 'Usta' });
      mockPrisma.staffLeave.findFirst.mockResolvedValue({ id: 'existing-leave-id' });

      await expect(
        service.createLeave(mockTenantId, {
          userId: mockUserId,
          leaveType: LeaveType.ANNUAL,
          startDate: '2026-09-20',
          endDate: '2026-09-25',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates leave successfully and records audit log', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: mockUserId, name: 'Ali', surname: 'Usta' });
      mockPrisma.staffLeave.findFirst.mockResolvedValue(null);
      const createdLeave = {
        id: mockLeaveId,
        tenantId: mockTenantId,
        userId: mockUserId,
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2026-09-20'),
        endDate: new Date('2026-09-25'),
        totalDays: 6,
        status: LeaveStatus.APPROVED,
      };
      mockPrisma.staffLeave.create.mockResolvedValue(createdLeave);

      const result = await service.createLeave(
        mockTenantId,
        {
          userId: mockUserId,
          leaveType: LeaveType.ANNUAL,
          startDate: '2026-09-20',
          endDate: '2026-09-25',
          reason: 'Yıllık izin',
        },
        'manager-user-id',
      );

      expect(result).toEqual(createdLeave);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'staff.leave_created',
          entityName: 'StaffLeave',
          entityId: mockLeaveId,
        }),
      );
    });
  });

  describe('cancelLeave', () => {
    it('throws NotFoundException if leave not found', async () => {
      mockPrisma.staffLeave.findFirst.mockResolvedValue(null);

      await expect(service.cancelLeave(mockTenantId, mockLeaveId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cancels leave successfully and writes audit log', async () => {
      mockPrisma.staffLeave.findFirst.mockResolvedValue({
        id: mockLeaveId,
        tenantId: mockTenantId,
        status: LeaveStatus.APPROVED,
      });
      mockPrisma.staffLeave.update.mockResolvedValue({
        id: mockLeaveId,
        status: LeaveStatus.CANCELLED,
      });

      const res = await service.cancelLeave(mockTenantId, mockLeaveId, 'actor-id');
      expect(res.status).toBe(LeaveStatus.CANCELLED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'staff.leave_cancelled',
          entityName: 'StaffLeave',
          entityId: mockLeaveId,
        }),
      );
    });
  });

  describe('getStaffAuditLogs', () => {
    it('returns logs with mapped user objects', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'staff.created',
          userId: mockUserId,
          entityName: 'User',
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: mockUserId, name: 'Ahmet', surname: 'Yılmaz', role: UserRole.SERVICE_MANAGER },
      ]);

      const logs = await service.getStaffAuditLogs(mockTenantId);
      expect(logs).toHaveLength(1);
      expect(logs[0].user).toBeDefined();
      expect(logs[0].user?.name).toBe('Ahmet');
    });
  });
});
