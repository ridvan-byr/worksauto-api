import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @ApiProperty({ enum: StockMovementType, example: StockMovementType.IN_PURCHASE })
  @IsEnum(StockMovementType, { message: 'Geçerli bir hareket tipi seçiniz (IN_PURCHASE, OUT_WORK_ORDER, ADJUSTMENT, RETURN).' })
  movementType: StockMovementType;

  @ApiProperty({ example: 10, description: 'Hareket miktarı (Pozitif tam sayı)' })
  @IsNumber()
  @Min(1, { message: 'Miktar en az 1 olmalıdır.' })
  quantity: number;

  @ApiProperty({ example: 'IRS-2026-0891', required: false, description: 'İrsaliye, fatura veya belge numarası' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ example: 'Castrol toptancı sevkiyatı mal kabulü', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
