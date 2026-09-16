import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateStaffLeaveDto } from './dto/staff-leave.dto';
import { UserRole, LeaveStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    let clean10 = digits;
    if (clean10.startsWith('90')) clean10 = clean10.slice(2);
    if (clean10.startsWith('0')) clean10 = clean10.slice(1);
    if (clean10.startsWith('5') && clean10.length === 10) {
      return '+90' + clean10;
    }
    return digits;
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      include: {
        mechanic: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { mechanic: true },
    });

    if (!user) {
      throw new NotFoundException('Personel bulunamadı.');
    }

    return user;
  }

  async create(
    tenantId: string,
    dto: CreateStaffDto,
    currentUserRole?: UserRole,
  ) {
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Süper Admin hesabı işletme içerisinden oluşturulamaz.',
      );
    }
    if (
      dto.role === UserRole.OWNER &&
      currentUserRole !== UserRole.OWNER &&
      currentUserRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Yalnızca işletme sahibi yeni bir İşletme Sahibi (OWNER) hesabı tanımlayabilir.',
      );
    }
    if (
      currentUserRole === UserRole.SERVICE_MANAGER &&
      (dto.role === UserRole.SERVICE_MANAGER || dto.role === UserRole.OWNER)
    ) {
      throw new ForbiddenException(
        'Servis müdürleri yalnızca teknisyen, veznedar veya depo sorumlusu hesapları açabilir.',
      );
    }

    const normalizedPhone = this.normalizePhone(dto.phone);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: '+' + normalizedPhone }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'Bu telefon numarasıyla kayıtlı bir personel zaten var.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          name: dto.name,
          surname: dto.surname,
          phone: normalizedPhone,
          email: dto.email || null,
          role: dto.role,
          isActive: true,
        },
      });

      if (dto.role === UserRole.TECHNICIAN) {
        await tx.mechanic.create({
          data: {
            tenantId,
            userId: user.id,
            specialty: dto.specialty || 'Genel Mekanik',
            assignedLift: dto.assignedLift || null,
            dailyCapacityHours: dto.dailyCapacityHours || 8,
          },
        });
      }

      try {
        await this.auditService.log({
          tenantId,
          action: 'staff.created',
          entityName: 'User',
          entityId: user.id,
          changesAfter: {
            name: `${dto.name} ${dto.surname || ''}`.trim(),
            role: dto.role,
            phone: normalizedPhone,
            specialty: dto.specialty,
          },
        });
      } catch (err) {
        console.error('Audit log failed for staff.created:', err);
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: { mechanic: true },
      });
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateStaffDto,
    currentUserRole?: UserRole,
  ) {
    const previousUser = await this.findOne(tenantId, id);
    const prevMechanic = previousUser.mechanic;

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Süper Admin rolü işletme içerisinden atanamaz.',
      );
    }
    if (
      dto.role === UserRole.OWNER &&
      currentUserRole !== UserRole.OWNER &&
      currentUserRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Yalnızca işletme sahibi bir personeli İşletme Sahibi (OWNER) yapabilir.',
      );
    }
    if (
      currentUserRole === UserRole.SERVICE_MANAGER &&
      (dto.role === UserRole.SERVICE_MANAGER || dto.role === UserRole.OWNER)
    ) {
      throw new ForbiddenException(
        'Servis müdürleri rolü servis müdürü veya dükkan sahibi olarak değiştiremez.',
      );
    }
    if (
      previousUser.role === UserRole.OWNER &&
      currentUserRole !== UserRole.OWNER &&
      currentUserRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'İşletme sahibi hesabında değişiklik yapma yetkiniz bulunmamaktadır.',
      );
    }

    let normalizedPhone: string | undefined;
    if (dto.phone) {
      normalizedPhone = this.normalizePhone(dto.phone);
      const existing = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [{ phone: normalizedPhone }, { phone: '+' + normalizedPhone }],
        },
      });

      if (existing) {
        throw new ConflictException(
          `Bu telefon numarası (${dto.phone}) zaten başka bir personele (${existing.name} ${existing.surname}) kayıtlıdır.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.name) updateData.name = dto.name;
      if (dto.surname) updateData.surname = dto.surname;
      if (normalizedPhone) updateData.phone = normalizedPhone;
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.role) updateData.role = dto.role;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      const user = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Update or create mechanic profile if technician
      const isTechnician = (dto.role || user.role) === UserRole.TECHNICIAN;
      let updatedMechanic: any = prevMechanic;

      if (
        isTechnician ||
        dto.specialty !== undefined ||
        dto.assignedLift !== undefined
      ) {
        const existingMechanic = await tx.mechanic.findUnique({
          where: { userId: id },
        });

        if (existingMechanic) {
          updatedMechanic = await tx.mechanic.update({
            where: { userId: id },
            data: {
              ...(dto.specialty !== undefined
                ? { specialty: dto.specialty }
                : {}),
              ...(dto.assignedLift !== undefined
                ? { assignedLift: dto.assignedLift }
                : {}),
              ...(dto.dailyCapacityHours !== undefined
                ? { dailyCapacityHours: dto.dailyCapacityHours }
                : {}),
            },
          });
        } else if (isTechnician) {
          updatedMechanic = await tx.mechanic.create({
            data: {
              tenantId,
              userId: id,
              specialty: dto.specialty || 'Genel Mekanik',
              assignedLift: dto.assignedLift || null,
              dailyCapacityHours: dto.dailyCapacityHours || 8,
            },
          });
        }
      }

      const oldLift = prevMechanic?.assignedLift || 'Atanmamış';
      const newLift = updatedMechanic?.assignedLift || 'Atanmamış';
      const isLiftChanged =
        dto.assignedLift !== undefined && oldLift !== newLift;
      const isRoleChanged =
        dto.role !== undefined && dto.role !== previousUser.role;
      const isStatusChanged =
        dto.isActive !== undefined && dto.isActive !== previousUser.isActive;

      const action =
        isLiftChanged && !isRoleChanged && !isStatusChanged
          ? 'staff.lift_changed'
          : 'staff.updated';

      try {
        await this.auditService.log({
          tenantId,
          action,
          entityName: 'User',
          entityId: id,
          changesBefore: {
            staffName:
              `${previousUser.name} ${previousUser.surname || ''}`.trim(),
            name: `${previousUser.name} ${previousUser.surname || ''}`.trim(),
            role: previousUser.role,
            assignedLift: oldLift,
            specialty: prevMechanic?.specialty || null,
            isActive: previousUser.isActive,
          },
          changesAfter: {
            staffName: `${user.name} ${user.surname || ''}`.trim(),
            name: `${user.name} ${user.surname || ''}`.trim(),
            role: user.role,
            assignedLift: newLift,
            liftChange: isLiftChanged ? `${oldLift} ➔ ${newLift}` : undefined,
            specialty: updatedMechanic?.specialty || null,
            isActive: user.isActive,
          },
        });
      } catch (err) {
        console.error('Audit log failed for staff.updated:', err);
      }

      return tx.user.findUnique({
        where: { id },
        include: { mechanic: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const user = await this.findOne(tenantId, id);

    const mechanic = user.mechanic;
    let hasReferences = false;
    if (mechanic) {
      const woCount = await this.prisma.workOrder.count({
        where: { assignedMechanicId: mechanic.id },
      });
      const appCount = await this.prisma.appointment.count({
        where: { assignedMechanicId: mechanic.id },
      });
      if (woCount > 0 || appCount > 0) hasReferences = true;
    }

    try {
      await this.auditService.log({
        tenantId,
        action: hasReferences ? 'staff.deactivated' : 'staff.deleted',
        entityName: 'User',
        entityId: id,
        changesBefore: {
          name: `${user.name} ${user.surname || ''}`.trim(),
          role: user.role,
          phone: user.phone,
        },
        changesAfter: {
          reason: hasReferences
            ? 'Geçmiş iş emri/randevu kayıtları olduğu için pasife alındı'
            : 'Kadro kaydı kalıcı silindi',
        },
      });
    } catch (err) {
      console.error('Audit log failed for staff remove:', err);
    }

    if (!hasReferences) {
      if (mechanic) {
        await this.prisma.mechanic.delete({ where: { id: mechanic.id } });
      }
      await this.prisma.user.delete({ where: { id } });
      return { success: true, message: 'Personel kaydı silindi.' };
    } else {
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        success: true,
        message: 'Personel geçmiş kayıtları bulunduğu için pasife alındı.',
      };
    }
  }

  async getLeaves(tenantId: string, userId?: string) {
    const where: any = { tenantId };
    if (userId) {
      where.userId = userId;
    }
    return this.prisma.staffLeave.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            role: true,
            phone: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            surname: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createLeave(
    tenantId: string,
    dto: CreateStaffLeaveDto,
    actorUserId?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException('Personel bulunamadı.');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Geçersiz tarih formatı.');
    }

    if (start > end) {
      throw new BadRequestException(
        'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
      );
    }

    // Check overlapping leaves
    const overlap = await this.prisma.staffLeave.findFirst({
      where: {
        tenantId,
        userId: dto.userId,
        status: { notIn: [LeaveStatus.CANCELLED] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (overlap) {
      throw new ConflictException(
        'Personelin bu tarih aralığında çakışan aktif bir izni zaten bulunmaktadır.',
      );
    }

    const diffDays =
      dto.totalDays !== undefined
        ? dto.totalDays
        : Math.max(
            0.5,
            Math.round(
              (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
            ) + 1,
          );

    const leave = await this.prisma.staffLeave.create({
      data: {
        tenantId,
        userId: dto.userId,
        leaveType: dto.leaveType,
        startDate: start,
        endDate: end,
        totalDays: diffDays,
        reason: dto.reason || null,
        status: LeaveStatus.APPROVED,
        approvedById: actorUserId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            role: true,
          },
        },
      },
    });

    try {
      await this.auditService.log({
        tenantId,
        userId: actorUserId,
        action: 'staff.leave_created',
        entityName: 'StaffLeave',
        entityId: leave.id,
        changesAfter: {
          userName: `${user.name} ${user.surname || ''}`.trim(),
          leaveType: dto.leaveType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays: diffDays,
          reason: dto.reason,
        },
      });
    } catch (err) {
      console.error('Audit log failed for staff leave:', err);
    }

    return leave;
  }

  async cancelLeave(tenantId: string, leaveId: string, actorUserId?: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
      include: { user: true },
    });

    if (!leave) {
      throw new NotFoundException('İzin kaydı bulunamadı.');
    }

    if (leave.status === LeaveStatus.CANCELLED) {
      throw new BadRequestException('Bu izin zaten iptal edilmiş.');
    }

    const updated = await this.prisma.staffLeave.update({
      where: { id: leaveId },
      data: { status: LeaveStatus.CANCELLED },
    });

    try {
      await this.auditService.log({
        tenantId,
        userId: actorUserId,
        action: 'staff.leave_cancelled',
        entityName: 'StaffLeave',
        entityId: leaveId,
        changesBefore: { status: leave.status },
        changesAfter: { status: LeaveStatus.CANCELLED },
      });
    } catch (err) {
      console.error('Audit log failed for staff leave cancel:', err);
    }

    return updated;
  }

  async getStaffAuditLogs(tenantId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [
          { action: { startsWith: 'staff.' } },
          { entityName: { in: ['User', 'StaffLeave', 'Mechanic'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = logs.map((l) => l.userId).filter(Boolean) as string[];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, surname: true, role: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return logs.map((log) => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) || null : null,
    }));
  }
}
