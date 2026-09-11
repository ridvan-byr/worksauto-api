import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'ahmet@worksauto.com' })
  @IsNotEmpty({ message: 'E-posta adresi boş bırakılamaz.' })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz.' })
  email: string;

  @ApiProperty({ example: 'GucluSifre2026!*' })
  @IsNotEmpty({ message: 'Şifre boş bırakılamaz.' })
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır.' })
  password: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsNotEmpty({ message: 'Yönetici adı boş bırakılamaz.' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Yılmaz', required: false })
  @IsOptional()
  @IsString()
  surname?: string;

  @ApiProperty({ example: '+905320000001' })
  @IsNotEmpty({ message: 'Telefon numarası boş bırakılamaz.' })
  @IsString()
  phone: string;
}

export class UpdateSuperAdminStatusDto {
  @ApiProperty({ example: true })
  @IsNotEmpty()
  isActive: boolean;
}
