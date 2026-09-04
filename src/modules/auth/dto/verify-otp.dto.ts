import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Kullanıcının kayıtlı cep telefonu numarası',
    example: '05551112233',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefon numarası zorunludur.' })
  phone: string;

  @ApiProperty({
    description: 'Telefona SMS ile gelen 6 haneli doğrulama kodu',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'Doğrulama kodu 6 haneli olmalıdır.' })
  code: string;
}
