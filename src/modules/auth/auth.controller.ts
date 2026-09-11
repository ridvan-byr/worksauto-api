import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterTenantDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { BypassB2bConsent } from '../../shared/decorators/bypass-b2b-consent.decorator';
import { AuthGuard } from '@nestjs/passport';

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Gün (milisaniye)
  path: '/api/v1/auth',
});

@ApiTags('Authentication & Security (Telefon + SMS OTP)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Kullanıcı telefonuna 6 haneli SMS doğrulama kodu gönderir (Redis 3 dk)',
  })
  @ApiResponse({
    status: 200,
    description: 'SMS OTP kodu başarıyla gönderildi.',
  })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'SMS kodunu doğrular ve 30 Günlük (1 Ay) kalıcı oturum başlatır',
  })
  @ApiResponse({
    status: 200,
    description:
      'Giriş başarılı. 30 günlük Refresh Token ve Access Token üretildi.',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto);
    if (result.refreshToken) {
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getRefreshTokenCookieOptions(),
      );
    }
    return result;
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Yeni bir servis işletmesi (tenant) ve yönetici hesabı oluşturur',
  })
  @ApiResponse({
    status: 201,
    description: 'Servis ve yönetici başarıyla oluşturuldu.',
  })
  async register(
    @Body() dto: RegisterTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerTenant(dto);
    if (result.refreshToken) {
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getRefreshTokenCookieOptions(),
      );
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '30 günlük süre boyunca oturumu sessizce yeniler' })
  @ApiResponse({ status: 200, description: 'Yeni token çifti üretildi.' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refreshToken || dto?.refreshToken;
    if (!token) {
      throw new UnauthorizedException(
        'Yenileme belirteci (refresh token) bulunamadı.',
      );
    }
    const result = await this.authService.refreshToken({ refreshToken: token });
    if (result.refreshToken) {
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getRefreshTokenCookieOptions(),
      );
    }
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kullanıcı oturumunu ve httpOnly cookie belirtecini sonlandırır',
  })
  @ApiResponse({ status: 200, description: 'Oturum kapatıldı.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    if (token) {
      await this.authService.revokeRefreshToken(token);
    }
    res.clearCookie('refreshToken', {
      ...getRefreshTokenCookieOptions(),
      maxAge: 0,
    });
    return { success: true, message: 'Oturum başarıyla sonlandırıldı.' };
  }

  @Get('me')
  @BypassB2bConsent()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Giriş yapan personelin oturum ve tenant bilgilerini döner',
  })
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id || user.sub);
  }
}
