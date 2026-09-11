import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({
    example: 'Periyodik Bakım (Yağ & Filtreler)',
    description: 'Hizmet / işçilik adı',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SRV-OIL-01', description: 'Benzersiz hizmet kodu' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'PERIYODIK_BAKIM',
    description: 'Hizmet kategorisi (MEKANIK, ELEKTRIK, KAPORTA, vb.)',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({
    example: 45,
    description: 'Tahmini işlem süresi (dakika)',
  })
  @IsNumber()
  @IsOptional()
  @Min(5)
  defaultDurationMin?: number;

  @ApiProperty({ example: 750, description: 'Taban işçilik fiyatı (TL)' })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: 20, description: 'KDV oranı (%)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  kdvRate?: number;

  @ApiPropertyOptional({ example: true, description: 'Hizmet aktif mi?' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
