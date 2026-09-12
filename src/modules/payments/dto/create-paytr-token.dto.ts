import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreatePayTrTokenDto {
  @ApiProperty({
    description: 'Ödeme alınacak faturanın benzersiz kimliği (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Fatura ID zorunludur.' })
  @IsUUID('4', { message: 'Geçersiz fatura kimliği biçimi.' })
  invoiceId: string;
}
