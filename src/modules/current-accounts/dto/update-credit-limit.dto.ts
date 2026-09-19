import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdateCreditLimitDto {
  @ApiProperty({
    description: 'Müşteri kredi limiti (0 = Limitsiz / Sınırsız)',
    example: 50000,
  })
  @IsNumber()
  @Min(0)
  creditLimit: number;

  @ApiProperty({
    description: 'Hesap blokesi',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
