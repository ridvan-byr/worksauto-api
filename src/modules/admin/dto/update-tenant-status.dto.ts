import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTenantStatusDto {
  @ApiProperty({ example: true, description: 'Servis aktif mi (lisanslı mı)?' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    required: false,
    example: 'Lisans ödemesi onaylandı',
    description: 'İşlem açıklaması veya dondurma gerekçesi',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
