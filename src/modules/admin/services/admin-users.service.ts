import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CreateSuperAdminDto } from '../dto/create-superadmin.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('5')) return '+90' + digits;
    if (digits.length === 11 && digits.startsWith('05')) return '+9' + digits;
    if (digits.length === 12 && digits.startsWith('905')) return '+' + digits;
    return phone.startsWith('+') ? phone : '+' + phone;
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        surname: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    dto: CreateSuperAdminDto,
    creatorUser?: { id: string; email: string },
  ) {
    const emailNormalized = dto.email.trim().toLowerCase();
    const phoneNormalized = this.normalizePhone(dto.phone);

    const existingEmail = await this.prisma.user.findFirst({
      where: { email: emailNormalized },
    });
    if (existingEmail) {
      throw new ConflictException(
        'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten mevcut.',
      );
    }

    const existingPhone = await this.prisma.user.findFirst({
      where: { phone: phoneNormalized },
    });
    if (existingPhone) {
      throw new ConflictException(
        'Bu telefon numarasıyla kayıtlı bir kullanıcı zaten mevcut.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: emailNormalized,
        phone: phoneNormalized,
        passwordHash,
        name: dto.name.trim(),
        surname: dto.surname?.trim() || null,
        role: UserRole.SUPER_ADMIN,
        tenantId: null, // Platform scope
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        surname: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: null,
          userId: creatorUser?.id || user.id,
          action: 'SECURITY_SUPERADMIN_CREATED',
          entityName: 'User',
          entityId: user.id,
          changesAfter: {
            createdAdminEmail: user.email,
            createdAdminName: `${user.name} ${user.surname || ''}`.trim(),
            createdBy: creatorUser?.email || 'SYSTEM_CLI',
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log could not be saved: ${e}`);
    }

    return user;
  }

  async updateStatus(id: string, isActive: boolean, currentAdminId?: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, role: UserRole.SUPER_ADMIN },
    });

    if (!target) {
      throw new NotFoundException('Yönetici bulunamadı.');
    }

    if (currentAdminId && target.id === currentAdminId && !isActive) {
      throw new BadRequestException('Kendi hesabınızı askıya alamazsınız.');
    }

    if (!isActive) {
      const activeCount = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Sistemdeki son aktif Super Admin hesabı askıya alınamaz.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        surname: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: null,
          userId: currentAdminId || null,
          action: isActive
            ? 'SECURITY_SUPERADMIN_ACTIVATED'
            : 'SECURITY_SUPERADMIN_SUSPENDED',
          entityName: 'User',
          entityId: id,
          changesAfter: {
            adminEmail: target.email,
            newStatus: isActive ? 'ACTIVE' : 'SUSPENDED',
            updatedBy: currentAdminId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log could not be saved: ${e}`);
    }

    return updated;
  }

  async remove(id: string, currentAdminId?: string) {
    const target = await this.prisma.user.findFirst({
      where: { id, role: UserRole.SUPER_ADMIN },
    });

    if (!target) {
      throw new NotFoundException('Yönetici bulunamadı.');
    }

    if (currentAdminId && target.id === currentAdminId) {
      throw new BadRequestException('Kendi yönetici hesabınızı silemezsiniz.');
    }

    const totalCount = await this.prisma.user.count({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (totalCount <= 1) {
      throw new BadRequestException(
        'Sistemdeki son Super Admin hesabı silinemez.',
      );
    }

    await this.prisma.user.delete({
      where: { id },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: null,
          userId: currentAdminId || null,
          action: 'SECURITY_SUPERADMIN_DELETED',
          entityName: 'User',
          entityId: id,
          changesAfter: {
            deletedAdminEmail: target.email,
            deletedBy: currentAdminId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log could not be saved: ${e}`);
    }

    return { success: true, message: 'Super Admin hesabı başarıyla silindi.' };
  }
}
