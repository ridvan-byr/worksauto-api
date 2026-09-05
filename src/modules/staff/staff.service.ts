import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('5')) return '90' + digits;
    if (digits.length === 11 && digits.startsWith('05')) return '9' + digits;
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

  async create(tenantId: string, dto: CreateStaffDto) {
    const normalizedPhone = this.normalizePhone(dto.phone);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: '+' + normalizedPhone },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Bu telefon numarasıyla kayıtlı bir personel zaten var.');
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

  async update(tenantId: string, id: string, dto: UpdateStaffDto) {
    await this.findOne(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.name) updateData.name = dto.name;
      if (dto.surname) updateData.surname = dto.surname;
      if (dto.phone) updateData.phone = this.normalizePhone(dto.phone);
      if (dto.email !== undefined) updateData.email = dto.email;
      if (dto.role) updateData.role = dto.role;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      const user = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Update or create mechanic profile if technician
      const isTechnician = (dto.role || user.role) === UserRole.TECHNICIAN;
      if (isTechnician || dto.specialty !== undefined || dto.assignedLift !== undefined) {
        const existingMechanic = await tx.mechanic.findUnique({
          where: { userId: id },
        });

        if (existingMechanic) {
          await tx.mechanic.update({
            where: { userId: id },
            data: {
              ...(dto.specialty !== undefined ? { specialty: dto.specialty } : {}),
              ...(dto.assignedLift !== undefined ? { assignedLift: dto.assignedLift } : {}),
              ...(dto.dailyCapacityHours !== undefined ? { dailyCapacityHours: dto.dailyCapacityHours } : {}),
            },
          });
        } else if (isTechnician) {
          await tx.mechanic.create({
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

      try {
        await this.auditService.log({
          tenantId,
          action: 'staff.updated',
          entityName: 'User',
          entityId: id,
          changesAfter: {
            name: `${user.name} ${user.surname || ''}`.trim(),
            role: user.role,
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
          reason: hasReferences ? 'Geçmiş iş emri/randevu kayıtları olduğu için pasife alındı' : 'Kadro kaydı kalıcı silindi',
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
      return { success: true, message: 'Personel geçmiş kayıtları bulunduğu için pasife alındı.' };
    }
  }
}
