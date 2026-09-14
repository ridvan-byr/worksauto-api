import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

/** Recheck current account privileges; a refresh JWT is never an API credential. */
export async function validateAccessIdentity(
  prisma: PrismaService,
  payload: any,
) {
  if (payload.tokenType !== 'access' || !payload.sub) {
    throw new UnauthorizedException('An access token is required.');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: true },
  });
  if (
    !user?.isActive ||
    user.role !== payload.role ||
    (user.tenantId || null) !== (payload.tenantId || null) ||
    (user.tenantId && !user.tenant?.isActive)
  ) {
    throw new UnauthorizedException(
      'This account or its permissions are no longer active.',
    );
  }
  if (user.role !== 'SUPER_ADMIN') {
    if (!payload.familyId)
      throw new UnauthorizedException('Session is missing.');
    const session = await prisma.refreshToken.findFirst({
      where: {
        userId: user.id,
        familyId: payload.familyId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw new UnauthorizedException('Session has been revoked.');
  }
  return user;
}
