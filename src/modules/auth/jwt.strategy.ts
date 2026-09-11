import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  branchId?: string;
  name: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.adminAccessToken || null,
        (req: any) => req?.cookies?.accessToken || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Geçersiz oturum belirteci (sub eksik).');
    }

    if (payload.role !== 'SUPER_ADMIN' && !payload.tenantId) {
      throw new UnauthorizedException(
        'Geçersiz oturum belirteci (tenantId eksik).',
      );
    }

    // Set tenant context into Cls for RLS isolation
    if (payload.tenantId) {
      // Check if tenant is active
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { id: true, isActive: true },
      });

      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException(
          'Bu oto servisinin lisansı askıya alınmıştır veya servis aktif değildir. Lütfen platform yöneticisi ile iletişime geçiniz.',
        );
      }

      this.cls.set('tenantId', payload.tenantId);
    }
    this.cls.set('userId', payload.sub);
    this.cls.set('userRole', payload.role);

    return {
      id: payload.sub,
      userId: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId || null,
      branchId: payload.branchId || null,
      name: payload.name,
    };
  }
}
