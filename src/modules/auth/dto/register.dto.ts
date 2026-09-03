import { IsEmail, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Yıldız Oto Servis Merkezi' })
  @IsNotEmpty({ message: 'Servis / Şirket adı boş bırakılamaz.' })
  tenantTitle: string;

  @ApiProperty({ example: 'yildiz-oto' })
  @IsNotEmpty({ message: 'Servis kısa kodu (slug) boş bırakılamaz.' })
  slug: string;

  @ApiProperty({ example: '02124440123' })
  @IsNotEmpty({ message: 'Telefon numarası boş bırakılamaz.' })
  phone: string;

  @ApiProperty({ example: 'Rıdvan' })
  @IsNotEmpty({ message: 'Yönetici adı boş bırakılamaz.' })
  firstName: string;

  @ApiProperty({ example: 'Bayar' })
  @IsNotEmpty({ message: 'Yönetici soyadı boş bırakılamaz.' })
  lastName: string;

  @ApiProperty({ example: 'ridvan@yildizoto.com' })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz.' })
  email: string;

  @ApiProperty({ example: 'Secret123!' })
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır.' })
  password: string;
}
