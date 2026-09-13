import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { InvoiceProviderType } from '@prisma/client';

export class UpdateInvoiceSettingsDto {
  @ApiProperty({
    enum: InvoiceProviderType,
    example: InvoiceProviderType.PARASUT,
    description: 'E-Fatura Sağlayıcı Türü',
  })
  @IsEnum(InvoiceProviderType)
  provider: InvoiceProviderType;

  @ApiPropertyOptional({ description: 'API Anahtarı / Client ID' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'API Secret / Client Secret' })
  @IsOptional()
  @IsString()
  apiSecret?: string;

  @ApiPropertyOptional({ description: 'Entegratör Kullanıcı Adı / E-Posta' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Entegratör Şifresi' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'İşletme VKN / TCKN' })
  @IsOptional()
  @IsString()
  companyTaxId?: string;

  @ApiPropertyOptional({ description: 'İşletme Vergi Dairesi' })
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiPropertyOptional({
    example: 'ATW',
    description: '3 Haneli GİB Fatura Seri Ön Eki',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  seriesPrefix?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Test / Sandbox ortamı modu',
  })
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'İş emri kapandığında otomatik faturaya dönüştürüp GİB kuyruğuna alsın mı?',
  })
  @IsOptional()
  @IsBoolean()
  autoSendOnCompletion?: boolean;
}

export class TestInvoiceConnectionDto {
  @ApiProperty({
    enum: InvoiceProviderType,
    example: InvoiceProviderType.PARASUT,
  })
  @IsEnum(InvoiceProviderType)
  provider: InvoiceProviderType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyTaxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;
}
