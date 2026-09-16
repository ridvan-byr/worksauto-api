import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

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

  @ApiProperty({
    required: false,
    example: 41.0082,
    description: 'İşletme harita enlem koordinatı (GPS)',
  })
  @IsOptional()
  latitude?: number;

  @ApiProperty({
    required: false,
    example: 28.9784,
    description: 'İşletme harita boylam koordinatı (GPS)',
  })
  @IsOptional()
  longitude?: number;

  @ApiProperty({
    required: false,
    example:
      'https://panel.worksauto.com.tr/media/files/public/tenants/logo.png',
    description: 'İşletme kurumsal logosunun URL adresi',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({
    required: false,
    example: 36,
    description: 'Üst menü kurumsal logo genişliği (px: 20 - 240)',
  })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(240)
  logoWidth?: number;

  @ApiProperty({
    required: false,
    example: 36,
    description: 'Üst menü kurumsal logo yüksekliği (px: 20 - 52)',
  })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(52)
  logoHeight?: number;

  @ApiProperty({
    required: false,
    example: 'https://g.page/r/CWd8xyz/review',
    description: 'Google İşletme / Dükkan Yorum ve Puanlama Bağlantısı',
  })
  @IsOptional()
  @IsString()
  googleReviewUrl?: string;

  @ApiProperty({
    required: false,
    example: 'Garanti BBVA',
    description: 'Banka Adı',
  })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({
    required: false,
    example: 'TR330006200000012345678901',
    description: 'Banka IBAN Numarası',
  })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiProperty({
    required: false,
    example: 'Bayar Otomotiv Sanayi Ltd. Şti.',
    description: 'Hesap Sahibi / Alıcı Ünvanı',
  })
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiProperty({
    required: false,
    example: '123456',
    description: 'PayTR Mağaza No (Merchant ID)',
  })
  @IsOptional()
  @IsString()
  paytrMerchantId?: string;

  @ApiProperty({
    required: false,
    example: 'sec_key_xyz',
    description: 'PayTR Mağaza Parolası (Merchant Key)',
  })
  @IsOptional()
  @IsString()
  paytrMerchantKey?: string;

  @ApiProperty({
    required: false,
    example: 'salt_abc_123',
    description: 'PayTR Gizli Anahtar (Merchant Salt)',
  })
  @IsOptional()
  @IsString()
  paytrMerchantSalt?: string;
}
