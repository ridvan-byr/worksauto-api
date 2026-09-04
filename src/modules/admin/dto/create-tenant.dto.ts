import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acar Oto Mekanik Servis' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Acar Motorlu Araçlar San. Tic. Ltd. Şti.' })
  @IsString()
  @IsOptional()
  legalName?: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: 'Acar' })
  @IsString()
  @IsNotEmpty()
  ownerSurname: string;

  @ApiProperty({ example: '+905321112233' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'info@acaroto.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'Ankara' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Ostim' })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ example: '100. Yıl Bulvarı No:42 Ostim Sanayi' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'Ostim Vergi Dairesi' })
  @IsString()
  @IsOptional()
  taxOffice?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
