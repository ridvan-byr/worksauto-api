import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_IDEMPOTENCY_KEY } from '../decorators/require-idempotency.decorator';

@Injectable()
export class RequireIdempotencyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawKey =
      request.headers['x-idempotency-key'] ||
      request.headers['idempotency-key'];

    if (!rawKey || !String(rawKey).trim()) {
      throw new BadRequestException(
        'Kritik finansal işlem için "X-Idempotency-Key" başlığı zorunludur. Lütfen benzersiz bir istek anahtarı sağlayınız.',
      );
    }

    return true;
  }
}
