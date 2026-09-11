import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BYPASS_B2B_CONSENT_KEY } from '../decorators/bypass-b2b-consent.decorator';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

@Injectable()
export class LegalConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. If route is marked as @Public(), allow pass-through
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 2. If route is marked with @BypassB2bConsent() (e.g. legal signing / auth logout), allow pass-through
    const bypassConsent = this.reflector.getAllAndOverride<boolean>(
      BYPASS_B2B_CONSENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (bypassConsent) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user context exists yet (or unauthenticated request), delegate to JwtAuthGuard
    if (!user) {
      return true;
    }

    // 3. Super Admins are platform operators and bypass tenant-level B2B consent
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // 4. For regular staff & tenant owners, verify that the tenant has accepted the B2B contract & KVKK
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, b2bConsentAccepted: true, title: true },
      });

      if (!tenant || !tenant.b2bConsentAccepted) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'LEGAL_CONSENT_REQUIRED',
          message:
            'WorksAuto B2B Hizmet Şartları ve KVKK Veri İşleme Sözleşmesi henüz onaylanmamıştır. Sistemi kullanabilmek için işletme yetkilisinin yasal sözleşmeyi onaylaması zorunludur.',
          tenantId: user.tenantId,
        });
      }
    }

    return true;
  }
}
