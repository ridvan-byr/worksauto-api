import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';

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
  constructor(private readonly cls: ClsService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'worksauto_super_secret_jwt_key_2026_production_grade',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Geçersiz oturum belirteci (token).');
    }

    // Set tenant context into Cls for RLS isolation
    this.cls.set('tenantId', payload.tenantId);
    this.cls.set('userId', payload.sub);
    this.cls.set('userRole', payload.role);

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      name: payload.name,
    };
  }
}
