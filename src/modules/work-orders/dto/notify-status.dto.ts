import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsIn,
  MaxLength,
} from 'class-validator';

export class NotifyWorkOrderStatusDto {
  @ApiPropertyOptional({
    example: ['EMAIL', 'WHATSAPP'],
    description:
      'Bildirimin gönderileceği kanallar. Boş bırakılırsa müşterinin iletişim bilgisine göre uygun tüm kanallar kullanılır.',
    enum: ['EMAIL', 'WHATSAPP', 'SMS'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(['EMAIL', 'WHATSAPP', 'SMS'], { each: true })
  channels?: ('EMAIL' | 'WHATSAPP' | 'SMS')[];

  @ApiPropertyOptional({
    example:
      'Aracınızın fren balatası montajı bitti, test sürüşü yapılmaktadır.',
    description: 'Müşteriye iletilecek özel açıklama/not',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customMessage?: string;
}
