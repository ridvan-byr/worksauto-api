import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Yıldız Oto Servis Merkezi', description: 'Servis işletmesinin ticari unvanı' })
  @IsNotEmpty({ message: 'Servis / Şirket adı boş bırakılamaz.' })
  @IsString()
  tenantTitle: string;

  @ApiProperty({ example: 'yildiz-oto', description: 'Servise özel benzersiz URL kısa kodu' })
  @IsNotEmpty({ message: 'Servis kısa kodu (slug) boş bırakılamaz.' })
  @IsString()
  slug: string;

  @ApiProperty({ example: '05551112233', description: 'Yöneticinin cep telefonu (SMS ile giriş için kullanılır)' })
  @IsNotEmpty({ message: 'Telefon numarası boş bırakılamaz.' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Rıdvan', description: 'Yetkili adı' })
  @IsNotEmpty({ message: 'Yönetici adı boş bırakılamaz.' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Bayar', description: 'Yetkili soyadı' })
  @IsNotEmpty({ message: 'Yönetici soyadı boş bırakılamaz.' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'ridvan@yildizoto.com', required: false, description: 'İsteğe bağlı bildirim e-postası' })
  @IsOptional()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz.' })
  email?: string;
}
