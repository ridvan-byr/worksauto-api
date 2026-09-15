import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @ApiPropertyOptional({ enum: CustomerType, default: CustomerType.INDIVIDUAL })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiProperty({ example: 'Ahmet' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Yılmaz' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'Yılmaz Otomotiv San. Tic. Ltd. Şti.' })
  @IsOptional()
  @IsString()
  companyTitle?: string;

  @ApiProperty({ example: '05321234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'ahmet@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '11111111111',
    description: 'Bireysel için 11 haneli TCKN veya Kurumsal için 10 haneli VKN',
  })
  @IsString()
  @IsNotEmpty({ message: 'T.C. Kimlik / Vergi Numarası zorunludur' })
  @Matches(/^[0-9]{10,11}$/, {
    message: 'T.C. Kimlik No 11 hane veya Vergi Numarası 10 hane olmalıdır',
  })
  taxNumber: string;

  @ApiPropertyOptional({ example: 'Kadıköy' })
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiPropertyOptional({ example: 'İstanbul' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Kadıköy' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Moda Cad. No: 12' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

export class QuickLeadDto {
  @ApiProperty({ example: 'Mehmet' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({ example: 'Kaya' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '05441234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '34ABC01' })
  @IsString()
  @IsNotEmpty()
  plate: string;

  @ApiPropertyOptional({ example: 'Renault' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 'Megane' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsNumber()
  year?: number;
}

export class BatchImportRowDto {
  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  companyTitle?: string;

  @ApiPropertyOptional({ enum: CustomerType })
  type?: CustomerType;

  @ApiPropertyOptional()
  taxNumber?: string;

  @ApiPropertyOptional()
  taxOffice?: string;

  @ApiPropertyOptional()
  city?: string;

  @ApiPropertyOptional()
  district?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  plate?: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  model?: string;

  @ApiPropertyOptional()
  year?: number;

  @ApiPropertyOptional()
  currentKm?: number;

  @ApiPropertyOptional()
  vin?: string;

  @ApiPropertyOptional()
  fuelType?: string;

  @ApiPropertyOptional()
  transmission?: string;
}

export class BatchImportRequestDto {
  @ApiProperty({ type: [BatchImportRowDto] })
  @IsArray()
  @ArrayMaxSize(200, {
    message: 'Tek seferde maksimum 200 satır içe aktarılabilir.',
  })
  @ValidateNested({ each: true })
  @Type(() => BatchImportRowDto)
  items: BatchImportRowDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Mevcut plaka veya telefon eşleştiğinde sistemdeki verileri günceller',
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;
}
