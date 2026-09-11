import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
} from 'class-validator';

export class CreateWorkshopBayDto {
  @ApiProperty({ example: 'Lift 1', description: 'İstasyon veya Lift Adı' })
  @IsNotEmpty({ message: 'İstasyon adı boş bırakılamaz.' })
  @IsString()
  name: string;

  @ApiProperty({
    required: false,
    example: 'L-01',
    description: 'İstasyon Kodu / Kısaltması',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    required: false,
    example: 'TWO_POST_LIFT',
    description:
      'Kategori: TWO_POST_LIFT, FOUR_POST_LIFT, SCISSOR_LIFT, ALIGNMENT, DIAGNOSTIC, WASH, GENERAL',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Online randevu portalında otomatik atanabilir mi?',
  })
  @IsOptional()
  @IsBoolean()
  isAvailableForOnline?: boolean;

  @ApiProperty({ required: false, default: 0, description: 'Listeleme Sırası' })
  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @ApiProperty({ required: false, default: true, description: 'Aktiflik Durumu' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWorkshopBayDto {
  @ApiProperty({ required: false, example: 'Lift 1 (Genel Mekanik)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: 'L-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false, example: 'TWO_POST_LIFT' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isAvailableForOnline?: boolean;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}
