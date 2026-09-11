import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    example: 'admin@worksauto.com',
    description: 'Kurumsal Super Admin E-Posta Adresi',
  })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz.' })
  @IsNotEmpty({ message: 'E-posta adresi zorunludur.' })
  email: string;

  @ApiProperty({
    example: 'WorksAuto2026!*',
    description: 'Süper Admin Parolası',
  })
  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır.' })
  @IsNotEmpty({ message: 'Şifre zorunludur.' })
  password: string;
}
