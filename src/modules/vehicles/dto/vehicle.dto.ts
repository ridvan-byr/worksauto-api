import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  Length,
} from 'class-validator';
import { FuelType, TransmissionType } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '34 ABC 123' })
  @IsString()
  @IsNotEmpty()
  plate: string;

  @ApiProperty({ example: 'Volkswagen' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Golf' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2022 })
  @IsNumber()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiPropertyOptional({ example: 'WVWZZZ1KZAM123456' })
  @IsOptional()
  @IsString()
  @Length(17, 17, { message: 'VIN 17 karakter olmalıdır.' })
  vin?: string;

  @ApiPropertyOptional({ example: 'CAXA123456' })
  @IsOptional()
  @IsString()
  engineNo?: string;

  @ApiPropertyOptional({ example: 'Beyaz' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: FuelType, default: FuelType.DIESEL })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiPropertyOptional({
    enum: TransmissionType,
    default: TransmissionType.MANUAL,
  })
  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  inspectionValidUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  insuranceValidUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  kaskoValidUntil?: Date;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: '34 ABC 123' })
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional({ example: 'Volkswagen' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Golf' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsNumber()
  @Min(1950)
  year?: number;

  @ApiPropertyOptional({ example: 'WVWZZZ1KZAM123456' })
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional({ example: 'CAXA123456' })
  @IsOptional()
  @IsString()
  engineNo?: string;

  @ApiPropertyOptional({ example: 'Beyaz' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: FuelType })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: TransmissionType })
  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  inspectionValidUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  insuranceValidUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  kaskoValidUntil?: Date;
}
