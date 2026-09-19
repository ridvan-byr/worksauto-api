import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    description: 'Kullanıcının kayıtlı cep telefonu numarası',
    example: '05551112233',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefon numarası zorunludur.' })
  phone: string;

  @ApiPropertyOptional({
    description:
      '30 gün geçerli güvenilir cihaz belirteci (varsa SMS kodsuz giriş sağlar)',
  })
  @IsOptional()
  @IsString()
  trustedDeviceToken?: string;
}
