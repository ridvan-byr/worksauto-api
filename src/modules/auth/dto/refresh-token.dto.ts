import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: '30 günlük geçerli refresh token' })
  @IsNotEmpty({ message: 'Refresh token boş bırakılamaz.' })
  refreshToken: string;
}
