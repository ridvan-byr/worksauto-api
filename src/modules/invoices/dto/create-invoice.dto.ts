import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Bağlı iş emri ID (Opsiyonel)' })
  @IsOptional()
  @IsString()
  workOrderId?: string;

  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', description: 'Müşteri ID' })
  @IsNotEmpty({ message: 'Müşteri seçilmelidir' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: '2026-04-15', description: 'Son ödeme vadesi (YYYY-MM-DD)' })
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
}
