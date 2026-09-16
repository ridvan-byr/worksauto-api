import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, IsEmail } from 'class-validator';

export class UpdateTenantAdminDto {
  @ApiPropertyOptional({ example: 'Acar Oto Mekanik Servis' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Acar Motorlu Araçlar San. Tic. Ltd. Şti.' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: '+905321112233' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@acaroto.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Ankara' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Ostim' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: '100. Yıl Bulvarı No:42 Ostim Sanayi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: '1234567890',
    description: '10 haneli VKN veya 11 haneli şahıs TCKN',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10,11}$/, {
    message: 'Vergi numarası 10 haneli VKN veya 11 haneli TCKN olmalıdır.',
  })
  taxNumber?: string;

  @ApiPropertyOptional({
    example: 'Ostim Vergi Dairesi',
    description: 'Bağlı olunan Vergi Dairesi',
  })
  @IsOptional()
  @IsString()
  taxOffice?: string;
}
