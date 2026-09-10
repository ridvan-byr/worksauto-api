import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateWorkOrderNoteDto {
  @ApiProperty({ example: 'Sağ amortisör patlak, parça tedarik edildi ve takıldı.', description: 'Güncellenen not metni' })
  @IsNotEmpty({ message: 'Not içeriği boş olamaz.' })
  @IsString({ message: 'Not metin formatında olmalıdır.' })
  @MaxLength(2000, { message: 'Not en fazla 2000 karakter olabilir.' })
  text: string;
}
