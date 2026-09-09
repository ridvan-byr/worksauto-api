import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';
import { RedisService } from '../infrastructure/redis/redis.service';

/**
 * Stripe-Grade In-Flight Protected Idempotency Interceptor
 *
 * Guarantees zero double-charging and race-condition immunity:
 * 1. Atomically claims "PROCESSING:{hash}" with 60s TTL via Redis SET NX EX 60.
 * 2. Returns 409 Conflict if another in-flight request with the same key is running.
 * 3. Returns 409 Conflict if key is reused with a different request body.
 * 4. Unlocks immediately (DEL) on server/validation errors so users can retry without waiting 60s.
 * 5. Returns cached response with X-Cache-Lookup: HIT if key is repeated with identical payload.
 * 6. Financial routes (/payments, /invoices, /current-accounts) FAIL-CLOSED on Redis failure.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // 1. Check for Idempotency Key header
    const rawKey =
      request.headers['x-idempotency-key'] ||
      request.headers['idempotency-key'];

    if (!rawKey) {
      // If header is omitted, continue standard pipeline
      return next.handle();
    }

    const keyStr = String(rawKey).trim();
    if (!keyStr) {
      return next.handle();
    }

    // 2. Tenant Scoping & Payload Hash
    const tenantId = request.user?.tenantId || request.headers['x-tenant-id'] || 'default';
    const bodyStr = JSON.stringify(request.body || {});
    const payloadHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

    const redisKey = `idempotency:${tenantId}:${keyStr}`;

    // Financial routes require strict fail-closed consistency to eliminate double-charges
    const reqUrl = request.url || '';
    const isFinancialRoute =
      reqUrl.includes('/payments') ||
      reqUrl.includes('/invoices') ||
      reqUrl.includes('/current-accounts');

    // 3. Atomic Lock Attempt via Redis SET NX EX 60
    const client = this.redis.getClient();

    if (!client || !this.redis.isHealthy()) {
      if (isFinancialRoute) {
        this.logger.error(`Redis unavailable for financial idempotency on ${reqUrl}. FAILING CLOSED.`);
        throw new ServiceUnavailableException(
          'Finansal işlem güvenliği için kilit servisi (Redis) şu anda yanıt vermiyor. Çift işlem riskini önlemek için talep durduruldu, lütfen az sonra tekrar deneyiniz.',
        );
      }
      this.logger.warn(`Redis is unavailable for idempotency locking on non-financial route ${reqUrl}. Operating in fail-open mode.`);
      return next.handle();
    }

    let lockResult: string | null = null;
    try {
      lockResult = await client.set(redisKey, `PROCESSING:${payloadHash}`, 'EX', 60, 'NX');
    } catch (err: any) {
      if (isFinancialRoute) {
        this.logger.error(`Redis lock acquisition error on financial route ${reqUrl}: ${err.message}. FAILING CLOSED.`);
        throw new ServiceUnavailableException(
          'Finansal işlem kilit servisinde hata oluştu. Çift işlem riskini önlemek için talep durduruldu.',
        );
      }
      this.logger.warn(`Redis lock acquisition error: ${err.message}. Proceeding fail-open.`);
      return next.handle();
    }

    // 4. Lock Evaluation
    if (lockResult !== 'OK') {
      // Key already exists in Redis
      const existingValue = await this.redis.get(redisKey);

      if (existingValue) {
        // Case A: In-flight execution in progress (Race Condition)
        if (existingValue.startsWith('PROCESSING:')) {
          throw new ConflictException('İşlem şu anda yürütülüyor, lütfen bekleyiniz.');
        }

        // Case B: Completed execution previously cached
        try {
          const cachedRecord = JSON.parse(existingValue);

          // Check for payload mismatch
          if (cachedRecord.hash && cachedRecord.hash !== payloadHash) {
            throw new ConflictException(
              'Idempotency Payload Mismatch: Aynı anahtar farklı bir istek gövdesiyle tekrar kullanılamaz.',
            );
          }

          // Return cached response seamlessly
          response.header('X-Cache-Lookup', 'HIT');
          if (cachedRecord.statusCode) {
            response.status(cachedRecord.statusCode);
          }
          return of(cachedRecord.body);
        } catch (parseError) {
          if (parseError instanceof ConflictException) {
            throw parseError;
          }
          this.logger.warn(`Failed to parse cached idempotency record: ${parseError}`);
        }
      }
    }

    // 5. Execution Pipeline with Unlock-on-Error & 24h Response Caching
    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          const statusCode = response.statusCode || 200;
          const cacheData = JSON.stringify({
            hash: payloadHash,
            statusCode,
            body: responseBody,
            createdAt: new Date().toISOString(),
          });
          // Cache successful execution for 24 hours (86,400 seconds)
          await this.redis.set(redisKey, cacheData, 86400);
        } catch (cacheErr: any) {
          this.logger.warn(`Failed to cache idempotency result: ${cacheErr.message}`);
        }
      }),
      catchError((error) => {
        // Critical: Unlock on error immediately so client can fix issues and retry
        this.redis.del(redisKey).catch((delErr: any) => {
          this.logger.warn(`Failed to release idempotency lock on error: ${delErr.message}`);
        });
        return throwError(() => error);
      }),
    );
  }
}
