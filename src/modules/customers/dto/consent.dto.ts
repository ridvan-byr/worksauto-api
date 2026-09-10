import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmConsentDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  kvkkAydinlatma?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  explicitConsent?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  commercialSms?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  commercialCall?: boolean;
}

export class DirectConsentDto {
  @ApiProperty({ example: 'PAPER_FORM' })
  @IsNotEmpty()
  @IsString()
  channel: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  commercialSms?: boolean;

  @ApiPropertyOptional({ example: '1.0' })
  @IsOptional()
  @IsString()
  policyVersion?: string;
}
