import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ProductCategory } from '@prisma/client';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Fren Balatası Ön' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'FB-2026-X' })
  @IsOptional()
  @IsString()
  oemCode?: string;

  @ApiPropertyOptional({ example: '8690123456789' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({ example: 'Bosch' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ example: 'A-12' })
  @IsOptional()
  @IsString()
  shelfLocation?: string;

  @ApiPropertyOptional({ example: 250.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 450.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  kdvRate?: number;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  aisle?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  rack?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  bin?: string;

  @ApiPropertyOptional({ example: 'd3b07384-d113-4a44-9c8a-789bb4671401' })
  @IsOptional()
  @IsString()
  shelfCellId?: string;
}
