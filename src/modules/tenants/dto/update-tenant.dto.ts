import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateTenantDto {
  @ApiProperty({ required: false, example: 'Bayar Oto Servis & Ekspertiz' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    required: false,
    example: 'Bayar Otomotiv San. ve Tic. Ltd. Şti.',
  })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false, example: '02125550123' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'info@bayaroto.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    required: false,
    example: 'İkitelli OSB, Dolapdere Sanayi Sitesi',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false, example: 'İstanbul' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false, example: 'Başakşehir' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ required: false, example: 'İkitelli' })
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiProperty({ required: false, example: '1234567890' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiProperty({
    required: false,
    example: true,
    description: 'İş emri tamamlandığında otomatik fatura kesilsin mi?',
  })
  @IsOptional()
  @IsBoolean()
  autoInvoiceOnComplete?: boolean;
}
