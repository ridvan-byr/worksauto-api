import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('Bu servis URL kodu (slug) zaten kullanımda.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          title: dto.tenantTitle,
          phone: dto.phone,
          email: dto.email,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.firstName,
          surname: dto.lastName,
          email: dto.email,
          passwordHash,
          role: UserRole.OWNER,
        },
      });

      const tokens = await this.generateTokens(user, tenant.id);
      return {
        tenant,
        user: {
          id: user.id,
          name: user.name,
          surname: user.surname,
          email: user.email,
          role: user.role,
        },
        ...tokens,
      };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const tokens = await this.generateTokens(user, user.tenantId);

    return {
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantTitle: user.tenant.title,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_SECRET || 'worksauto_super_secret_jwt_key_2026_production_grade',
      });

      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: dto.refreshToken },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Geçersiz yenileme belirteci.');
      }

      // REUSE DETECTION ALGORITHM (Security Threat)
      if (tokenRecord.isRevoked) {
        this.logger.warn(
          `Security Alert: Revoked refresh token reuse detected for user ${tokenRecord.userId}! Revoking all sessions in family.`,
        );
        // Revoke all tokens in this family immediately
        await this.prisma.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException('Güvenlik uyarısı: Oturum belirteci geçersiz kılındı. Lütfen tekrar giriş yapın.');
      }

      // Revoke current token (Rotation)
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: tokenRecord.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Kullanıcı bulunamadı veya pasif durumda.');
      }

      // Generate new tokens in the SAME family
      return this.generateTokens(user, user.tenantId, tokenRecord.familyId);
    } catch (e: any) {
      throw new UnauthorizedException('Oturum süresi doldu. Lütfen tekrar giriş yapınız.');
    }
  }

  private async generateTokens(user: any, tenantId: string, existingFamilyId?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      branchId: user.branchId,
      name: `${user.name} ${user.surname}`,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

    const familyId = existingFamilyId || uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 Days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshToken,
        familyId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
