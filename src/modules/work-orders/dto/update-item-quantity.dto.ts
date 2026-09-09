import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateWorkOrderItemQuantityDto {
  @ApiProperty({ example: 2, description: 'Yeni miktar/adet' })
  @IsInt({ message: 'Miktar tam sayı olmalıdır.' })
  @Min(1, { message: 'Miktar en az 1 olmalıdır.' })
  quantity: number;
}
