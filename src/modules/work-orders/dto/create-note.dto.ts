import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateWorkOrderNoteDto {
  @ApiProperty({
    example: 'Sağ amortisör patlak, yeni parça siparişi verildi.',
    description: 'Not metni',
  })
  @IsNotEmpty({ message: 'Not içeriği boş olamaz.' })
  @IsString({ message: 'Not metin formatında olmalıdır.' })
  @MaxLength(2000, { message: 'Not en fazla 2000 karakter olabilir.' })
  text: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Dahili atölye içi not mu?',
  })
  @IsOptional()
  @IsBoolean({ message: 'isInternal alanı mantıksal değer olmalıdır.' })
  isInternal?: boolean;
}
