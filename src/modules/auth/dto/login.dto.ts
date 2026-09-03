import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'ridvan@yildizoto.com' })
  @IsEmail({}, { message: 'Lütfen geçerli bir e-posta adresi giriniz.' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty({ message: 'Şifre alanı boş bırakılamaz.' })
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır.' })
  password: string;
}
