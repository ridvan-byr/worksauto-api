import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (dto.role === UserRole.TECHNICIAN || dto.specialty || dto.assignedLift) {
        const existingMechanic = await tx.mechanic.findUnique({
          where: { userId: id },
        });

        if (existingMechanic) {
          await tx.mechanic.update({
            where: { userId: id },
            data: {
              ...(dto.specialty ? { specialty: dto.specialty } : {}),
              ...(dto.assignedLift !== undefined ? { assignedLift: dto.assignedLift } : {}),
              ...(dto.dailyCapacityHours ? { dailyCapacityHours: dto.dailyCapacityHours } : {}),
            },
          });
        } else if (user.role === UserRole.TECHNICIAN) {
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

      return tx.user.findUnique({
        where: { id },
        include: { mechanic: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
