import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalJwtAuthGuard
 * Passport JWT doğrulamasını işletir:
 * - Geçerli bir Bearer token veya adminAccessToken varsa request.user doldurulur.
 * - Token yoksa, bozuksa veya süresi dolmuşsa 401 fırlatmaz, request.user'ı null bırakıp isteği geçirir.
 * Bu sayede hem JWT ile hem de alternatif mekanizmalarla (X-Health-Token gibi) korunan
 * hibrit endpoint'ler sorunsuz çalışır.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  handleRequest(err: any, user: any) {
    return user || null;
  }
}
