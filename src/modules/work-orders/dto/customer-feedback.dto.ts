import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitCustomerFeedbackDto {
  @ApiProperty({ description: 'Müşteri memnuniyet puanı (1 - 5)', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Müşteri geri bildirim notu veya şikayet detayı',
    example: 'Hızlı ve güler yüzlü hizmet, teşekkürler.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
