import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'Kullanıcının kayıtlı cep telefonu numarası',
    example: '05551112233',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefon numarası zorunludur.' })
  phone: string;
}
