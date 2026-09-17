import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @ApiProperty({ example: 'Periyodik Bakım İşçiliği' })
  @IsNotEmpty({ message: 'Kalem adı boş bırakılamaz' })
  @IsString()
  @MinLength(3, { message: 'Kalem adı en az 3 karakter olmalıdır' })
  name: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  kdvRate?: number;

  @ApiPropertyOptional({ example: 1200.0 })
  @IsOptional()
  @IsNumber()
  totalPrice?: number;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Bağlı iş emri ID (Opsiyonel)',
  })
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiProperty({
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description: 'Müşteri ID',
  })
  @IsNotEmpty({ message: 'Müşteri seçilmelidir' })
  @IsString()
  customerId: string;

  @ApiProperty({
    example: '2026-04-15',
    description: 'Son ödeme vadesi (YYYY-MM-DD)',
  })
  @IsNotEmpty({ message: 'Vade tarihi belirtilmelidir' })
  @IsString()
  dueDate: string;

  @ApiProperty({ example: 2500.0, description: 'KDV hariç ara toplam' })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiProperty({ example: 500.0, description: 'Toplam KDV tutarı' })
  @IsNumber()
  @Min(0)
  kdvAmount: number;

  @ApiProperty({ example: 3000.0, description: 'KDV dahil genel toplam' })
  @IsNumber()
  @Min(0)
  grandTotal: number;

  @ApiPropertyOptional({
    example: 900.0,
    description: 'Müşteri cari avansından faturaya mahsup edilecek tutar',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offsetAdvanceAmount?: number;

  @ApiPropertyOptional({
    type: [CreateInvoiceItemDto],
    description: 'Fatura satır kalemleri',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    example:
      'İşbu fatura muhteviyatı teslim edilmiş olup, irsaliye yerine geçer.',
    description: 'Fatura açıklama ve yasal notları',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'TICARIFATURA',
    description:
      'E-Fatura Senaryo Türü (TICARIFATURA, TEMELFATURA, EARSIVFATURA)',
  })
  @IsOptional()
  @IsString()
  profileId?: 'TICARIFATURA' | 'TEMELFATURA' | 'EARSIVFATURA';

  @ApiPropertyOptional({
    example: true,
    description:
      'Müşteriye online ödeme linki SMS/WhatsApp/E-posta bildirimi gönderilsin mi? Peşin/anında tahsilatlarda mükerrer mesajı engellemek için false verilebilir.',
  })
  @IsOptional()
  @IsBoolean()
  sendPaymentLinkNotification?: boolean;
}
