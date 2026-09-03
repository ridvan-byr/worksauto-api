import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication & Security')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Yeni bir servis işletmesi (tenant) ve yönetici hesabı oluşturur' })
  @ApiResponse({ status: 201, description: 'Servis ve yönetici başarıyla oluşturuldu.' })
  register(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanıcı girişi yapar (15m Access Token + 30d Refresh Token)' })
  @ApiResponse({ status: 200, description: 'Giriş başarılı.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Oturumu yeniler (Token Family Rotation & Reuse Detection)' })
  @ApiResponse({ status: 200, description: 'Yeni token çifti üretildi.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Giriş yapan kullanıcının oturum ve tenant bilgilerini döner' })
  getProfile(@CurrentUser() user: any) {
    return user;
  }
}
