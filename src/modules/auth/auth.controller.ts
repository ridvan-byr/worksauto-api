import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterTenantDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication & Security (Telefon + SMS OTP)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcı telefonuna 6 haneli SMS doğrulama kodu gönderir (Redis 3 dk)' })
  @ApiResponse({ status: 200, description: 'SMS OTP kodu başarıyla gönderildi.' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SMS kodunu doğrular ve 30 Günlük (1 Ay) kalıcı oturum başlatır' })
  @ApiResponse({ status: 200, description: 'Giriş başarılı. 30 günlük Refresh Token ve Access Token üretildi.' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Yeni bir servis işletmesi (tenant) ve yönetici hesabı oluşturur' })
  @ApiResponse({ status: 201, description: 'Servis ve yönetici başarıyla oluşturuldu.' })
  register(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '30 günlük süre boyunca oturumu sessizce yeniler' })
  @ApiResponse({ status: 200, description: 'Yeni token çifti üretildi.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Giriş yapan personelin oturum ve tenant bilgilerini döner' })
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
