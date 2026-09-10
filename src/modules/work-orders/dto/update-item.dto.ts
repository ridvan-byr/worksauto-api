import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateWorkOrderItemDto {
  @ApiPropertyOptional({ example: 'Ön Fren Balata Değişimi & Disk Taşlama', description: 'İşçilik veya parça adı' })
  @IsOptional()
  @IsString({ message: 'Kalem adı metin olmalıdır.' })
  name?: string;

  @ApiPropertyOptional({ example: 850, description: 'Birim fiyat (TL)' })
  @IsOptional()
  @IsNumber({}, { message: 'Birim fiyat sayısal olmalıdır.' })
  @Min(0, { message: 'Birim fiyat 0 veya daha büyük olmalıdır.' })
  unitPrice?: number;

  @ApiPropertyOptional({ example: 1, description: 'Miktar / Adet' })
  @IsOptional()
  @IsInt({ message: 'Miktar tam sayı olmalıdır.' })
  @Min(1, { message: 'Miktar en az 1 olmalıdır.' })
  quantity?: number;
}
