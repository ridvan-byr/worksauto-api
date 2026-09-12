import { SetMetadata } from '@nestjs/common';

export const REQUIRE_IDEMPOTENCY_KEY = 'require_idempotency';

/**
 * Decorator to enforce X-Idempotency-Key header on critical state-changing routes
 * (e.g. POST /payments, POST /invoices).
 */
export const RequireIdempotency = () =>
  SetMetadata(REQUIRE_IDEMPOTENCY_KEY, true);
