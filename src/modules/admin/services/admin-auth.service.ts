import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Super Admin E-Posta & Şifre ile Doğrulama (IP & UserAgent Güvenlik Kayıtlı)
   */
  async login(dto: AdminLoginDto, ipAddress?: string, userAgent?: string) {
    const emailNormalized = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email: emailNormalized,
        isActive: true,
      },
    });

    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: null,
            userId: null,
            action: 'SECURITY_LOGIN_FAILED',
            entityName: 'SecurityAuth',
            entityId: 'unauthorized',
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            changesAfter: {
              attemptedEmail: emailNormalized,
              reason: 'Bilinmeyen e-posta veya yetkisiz erişim denemesi.',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Security audit log failure: ${e}`);
      }
      throw new UnauthorizedException(
        'Geçersiz yönetici kimlik bilgileri veya yetkisiz hesap.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Bu hesap için parola tanımlanmamıştır.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: null,
            userId: user.id,
            action: 'SECURITY_LOGIN_FAILED',
            entityName: 'SecurityAuth',
            entityId: user.id,
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            changesAfter: {
              attemptedEmail: emailNormalized,
              reason: 'Hatalı şifre girişi.',
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (e) {
        this.logger.warn(`Security audit log failure: ${e}`);
      }
      throw new UnauthorizedException('Girdiğiniz şifre hatalı.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: null,
          userId: user.id,
          action: 'SECURITY_LOGIN_SUCCESS',
          entityName: 'SecurityAuth',
          entityId: user.id,
          ipAddress: ipAddress || '127.0.0.1',
          userAgent: userAgent || 'Unknown',
          changesAfter: {
            email: user.email,
            status: 'SESSION_INITIALIZED',
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      this.logger.warn(`Security audit log failure: ${e}`);
    }

    this.logger.log(
      `👑 Super Admin console access granted: ${user.email} (IP: ${ipAddress})`,
    );

    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }
}
