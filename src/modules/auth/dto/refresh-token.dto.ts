import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: '30 günlük geçerli refresh token (Cookie yoksa body üzerinden iletilebilir)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
