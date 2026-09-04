import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { WorkOrderItemType } from '@prisma/client';

export class AddWorkOrderItemDto {
  @ApiProperty({ enum: WorkOrderItemType, example: WorkOrderItemType.PART })
  @IsEnum(WorkOrderItemType, { message: 'Geçerli bir kalem tipi seçiniz (SERVICE veya PART).' })
  itemType: WorkOrderItemType;

  @ApiProperty({ required: false, description: 'Yedek parça ID (stoktan düşülecekse)' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ example: 'Ön Fren Balata Takımı' })
  @IsNotEmpty({ message: 'Kalem adı / tanımı boş bırakılamaz.' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1, default: 1 })
  @IsNumber()
  @Min(1, { message: 'Miktar en az 1 olmalıdır.' })
  quantity: number;

  @ApiProperty({ example: 1250.0 })
  @IsNumber()
  @Min(0, { message: 'Birim fiyat 0 veya daha büyük olmalıdır.' })
  unitPrice: number;

  @ApiProperty({ example: 20.0, default: 20.0, required: false })
  @IsOptional()
  @IsNumber()
  kdvRate?: number;
}
