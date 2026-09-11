import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';
import { RegisterTenantDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Telefon numarasını standart formata getirir (örn: 905551112233)
   */
  normalizePhone(rawPhone: string): string {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10 && digits.startsWith('5')) {
      return '90' + digits;
    }
    if (digits.length === 11 && digits.startsWith('05')) {
      return '9' + digits;
    }
    if (digits.length === 12 && digits.startsWith('90')) {
      return digits;
    }
    return digits;
  }

  /**
   * Kullanıcının telefonuna 6 haneli tek kullanımlık SMS OTP kodu gönderir.
   */
  async sendOtp(dto: SendOtpDto) {
    const normalizedPhone = this.normalizePhone(dto.phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      throw new BadRequestException(
        'Lütfen geçerli bir cep telefonu numarası giriniz.',
      );
    }

    // 10 haneli saf numara (örn: 5551112233)
    const raw10 = normalizedPhone.slice(-10);
    // Boşluklu varyasyon (örn: "555 111 2233" veya "555 111 22 33")
    const formattedWithSpaces = `${raw10.slice(0, 3)} ${raw10.slice(3, 6)} ${raw10.slice(6, 8)} ${raw10.slice(8, 10)}`;
    const formattedAlt = `${raw10.slice(0, 3)} ${raw10.slice(3, 6)} ${raw10.slice(6)}`;

    // 0. SMS Rate Limiting / Abuse Protection (Cooldown: 60s, Hourly Limit: 5)
    const cooldownKey = `rate:otp:cooldown:${normalizedPhone}`;
    const isCoolingDown = await this.redis.get(cooldownKey);
    if (isCoolingDown) {
      throw new BadRequestException(
        'Lütfen yeni bir SMS kodu istemeden önce 60 saniye bekleyiniz.',
      );
    }

    const hourlyLimitKey = `rate:otp:hourly:${normalizedPhone}`;
    const hourlyCount = parseInt(
      (await this.redis.get(hourlyLimitKey)) || '0',
      10,
    );
    if (hourlyCount >= 5) {
      throw new BadRequestException(
        'Bu telefon numarası için saatlik SMS gönderim limiti (5) aşıldı. Lütfen 1 saat sonra tekrar deneyiniz.',
      );
    }

    // Strict non-wildcard phone lookup (prevents account enumeration)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: '+' + normalizedPhone },
          { phone: raw10 },
          { phone: formattedWithSpaces },
          { phone: formattedAlt },
        ],
        isActive: true,
      },
      include: { tenant: true },
    });

    // Account Enumeration Defense:
    // If the phone number is not registered or the tenant is suspended,
    // do not disclose account existence. Return generic success message
    // but do not issue an OTP code or dispatch SMS.
    if (!user || (user.tenant && !user.tenant.isActive)) {
      this.logger.warn(
        `[AuthService] OTP talep edildi ancak kayıtlı/aktif hesap bulunamadı (Enumeration koruması aktif): ${normalizedPhone.slice(0, 5)}***`,
      );
      return {
        success: true,
        message: 'Doğrulama kodu telefonunuza SMS ile gönderildi.',
        phone: normalizedPhone,
        expiresInSeconds: 180,
      };
    }

    // 6 Haneli Kriptografik Olarak Güvenli OTP Kod Üretimi
    const otpCode =
      process.env.NODE_ENV === 'production'
        ? crypto.randomInt(100000, 1000000).toString()
        : '123456';

    // Redis üzerinde 3 dakika (180 saniye) geçerli olarak sakla
    const redisKey = `otp:${normalizedPhone}`;
    await this.redis.set(redisKey, otpCode, 180);

    // Cooldown (60s) ve saatlik sayacı (3600s) set et
    await this.redis.set(cooldownKey, '1', 60);
    await this.redis.set(hourlyLimitKey, (hourlyCount + 1).toString(), 3600);

    // Güvenli Log: Üretimde OTP kodunu asla loglama!
    const maskedPhone =
      normalizedPhone.slice(0, 5) + '***' + normalizedPhone.slice(-2);
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `📱 SMS OTP Gönderildi -> Telefon: ${maskedPhone} | Kod: ${otpCode} (Geçerlilik: 3 dk)`,
      );
    } else {
      this.logger.log(
        `📱 SMS OTP Gönderildi -> Telefon: ${maskedPhone} (Geçerlilik: 3 dk)`,
      );
    }

    return {
      success: true,
      message: 'Doğrulama kodu telefonunuza SMS ile gönderildi.',
      phone: normalizedPhone,
      expiresInSeconds: 180,
      devCode:
        process.env.NODE_ENV === 'development' &&
        process.env.ENABLE_DEV_OTP_BYPASS === 'true'
          ? otpCode
          : undefined,
    };
  }

  /**
   * SMS ile gelen 6 haneli OTP kodunu doğrular ve 30 GÜNLÜK (1 Ay) oturum token'ı üretir.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const raw10 = normalizedPhone.slice(-10);
    const formattedWithSpaces = `${raw10.slice(0, 3)} ${raw10.slice(3, 6)} ${raw10.slice(6, 8)} ${raw10.slice(8, 10)}`;
    const formattedAlt = `${raw10.slice(0, 3)} ${raw10.slice(3, 6)} ${raw10.slice(6)}`;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: '+' + normalizedPhone },
          { phone: raw10 },
          { phone: formattedWithSpaces },
          { phone: formattedAlt },
        ],
        isActive: true,
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Bu telefon numarasına ait kullanıcı hesabı bulunamadı.',
      );
    }

    if (user.tenant && !user.tenant.isActive) {
      throw new UnauthorizedException(
        'Bağlı olduğunuz oto servisinin lisansı askıya alınmıştır. Lütfen platform yöneticisi ile görüşünüz.',
      );
    }

    const redisKey = `otp:${normalizedPhone}`;
    const attemptKey = `otp_attempts:${normalizedPhone}`;

    // Brute-force deneme kontrolü (Maksimum 5 deneme)
    const attempts = parseInt((await this.redis.get(attemptKey)) || '0', 10);
    if (attempts >= 5) {
      await this.redis.del(redisKey);
      throw new UnauthorizedException(
        'Çok fazla hatalı kod denemesi yapıldı. Güvenliğiniz için doğrulama kodu iptal edildi. Lütfen 15 dakika sonra yeni bir kod isteyiniz.',
      );
    }

    const cachedCode = await this.redis.get(redisKey);

    // Katı Whitelist: Yalnızca development modunda ve ENABLE_DEV_OTP_BYPASS=true iken 123456 geçerlidir
    const isMasterDevCode =
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_DEV_OTP_BYPASS === 'true' &&
      dto.code === '123456';
    if (!cachedCode && !isMasterDevCode) {
      throw new UnauthorizedException(
        'Doğrulama kodunun süresi dolmuş veya hiç istenmemiş.',
      );
    }

    if (cachedCode && cachedCode !== dto.code && !isMasterDevCode) {
      const newAttempts = attempts + 1;
      await this.redis.set(attemptKey, newAttempts.toString(), 900); // 15 dakika TTL
      if (newAttempts >= 5) {
        await this.redis.del(redisKey);
        throw new UnauthorizedException(
          'Çok fazla hatalı kod denemesi yapıldı. Güvenliğiniz için doğrulama kodu iptal edildi. Lütfen 15 dakika sonra yeni bir kod isteyiniz.',
        );
      }
      throw new UnauthorizedException(
        `Girdiğiniz doğrulama kodu hatalı. Kalan deneme hakkı: ${5 - newAttempts}`,
      );
    }

    // Kod başarıyla doğrulandı, tek kullanımlık kodu ve deneme sayacını Redis'ten sil
    await this.redis.del(redisKey);
    await this.redis.del(attemptKey);

    // 30 GÜNLÜK (1 AY) REFRESH TOKEN ÜRET
    const tokens = await this.generateTokens(user, user.tenantId);

    this.logger.log(
      `✅ Usta / Yönetici giriş yaptı: ${user.name} ${user.surname} (${user.role}) - 30 Günlük Oturum Başlatıldı.`,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        phone: user.phone,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantTitle: user.tenant.title,
      },
      ...tokens,
    };
  }

  /**
   * Yeni Servis İşletmesi (Tenant) ve Sahibi (Owner) Kaydı
   */
  async registerTenant(dto: RegisterTenantDto) {
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        'Bu servis URL kodu (slug) zaten kullanımda.',
      );
    }

    const normalizedPhone = this.normalizePhone(dto.phone);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          title: dto.tenantTitle,
          phone: normalizedPhone,
          email: dto.email,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          name: dto.firstName,
          surname: dto.lastName,
          phone: normalizedPhone,
          email: dto.email,
          role: UserRole.OWNER,
        },
      });

      return { tenant: createdTenant, user: createdUser };
    });

    const tokens = await this.generateTokens(user, tenant.id);
    return {
      tenant,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  /**
   * Oturumu 30 gün boyunca sessizce yenileyen Token Family Rotation mekanizması
   */
  async refreshToken(dto: RefreshTokenDto) {
    try {
      this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const hashedToken = crypto
        .createHash('sha256')
        .update(dto.refreshToken)
        .digest('hex');
      let tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashedToken },
      });

      if (!tokenRecord) {
        // Fallback for legacy unhashed tokens during transition
        tokenRecord = await this.prisma.refreshToken.findUnique({
          where: { tokenHash: dto.refreshToken },
        });
      }

      if (!tokenRecord) {
        throw new UnauthorizedException('Geçersiz yenileme belirteci.');
      }

      // REUSE DETECTION (Çalınma Tespiti)
      if (tokenRecord.isRevoked) {
        this.logger.warn(
          `Güvenlik Uyarısı: İptal edilmiş token tekrar kullanılmaya çalışıldı (${tokenRecord.userId}). Tüm aile oturumları kapatılıyor.`,
        );
        await this.prisma.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { isRevoked: true },
        });
        throw new UnauthorizedException(
          'Güvenlik uyarısı: Oturumunuz sonlandırıldı. Lütfen telefonunuza SMS isteyerek tekrar giriş yapın.',
        );
      }

      // Token rotasyonu
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: tokenRecord.userId },
        include: { tenant: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException(
          'Kullanıcı hesabı bulunamadı veya pasif durumda.',
        );
      }

      if (user.tenant && !user.tenant.isActive) {
        throw new UnauthorizedException(
          'Bağlı olduğunuz oto servisinin lisansı askıya alınmıştır. Giriş yetkiniz geçersizdir.',
        );
      }

      return this.generateTokens(user, user.tenantId, tokenRecord.familyId);
    } catch {
      throw new UnauthorizedException(
        '30 günlük oturum süreniz doldu. Lütfen SMS ile tekrar giriş yapınız.',
      );
    }
  }

  /**
   * Refresh token iptal etme (Logout esnasında DB'deki token kaydını ve aileyi iptal eder)
   */
  async revokeRefreshToken(token?: string): Promise<void> {
    if (!token) return;
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          OR: [{ tokenHash: hashedToken }, { tokenHash: token }],
        },
      });
      if (tokenRecord) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: tokenRecord.familyId },
          data: { isRevoked: true },
        });
        this.logger.log(
          `Refresh token family (${tokenRecord.familyId}) revoked on logout.`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Token revocation error: ${err.message}`);
    }
  }

  /**
   * 1 Saatlik Access Token + 30 GÜNLÜK (1 Ay) Refresh Token Üretir.
   */
  private async generateTokens(
    user: any,
    tenantId: string,
    existingFamilyId?: string,
  ) {
    const payload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      tenantId,
      branchId: user.branchId,
      name: `${user.name} ${user.surname}`,
    };

    // 1 saatlik hızlı erişim anahtarı
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    // 30 GÜNLÜK kalıcı yenileme anahtarı (benzersiz jti ile üretilir, eşzamanlı istek çakışması engellenir)
    const refreshToken = this.jwtService.sign(
      { ...payload, jti: uuidv4() },
      { expiresIn: '30d' },
    );

    const familyId = existingFamilyId || uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 Gün

    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedToken,
        familyId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 saat
    };
  }

  /**
   * Giriş yapan personelin veritabanındaki en güncel profil ve tenant bilgilerini döner
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }
    if (user.tenant && !user.tenant.isActive) {
      throw new UnauthorizedException(
        'Bağlı olduğunuz oto servisinin lisansı askıya alınmıştır. Lütfen platform yöneticisi ile görüşünüz.',
      );
    }
    return {
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        phone: user.phone,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantTitle: user.tenant?.title,
      },
      tenant: user.tenant,
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      name: `${user.name} ${user.surname}`.trim(),
    };
  }
}
