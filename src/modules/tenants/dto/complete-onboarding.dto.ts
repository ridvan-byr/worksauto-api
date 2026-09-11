import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingServiceItemDto {
  @ApiPropertyOptional({ example: 'srv_1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Periyodik Bakım (Yağ + 4 Filtre)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Periyodik Bakım' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 60 })
  @IsNumber()
  durationMinutes: number;

  @ApiProperty({ example: 1250 })
  @IsNumber()
  laborPrice: number;
}

export class OnboardingStaffItemDto {
  @ApiPropertyOptional({ example: 'st_1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Usta' })
  @IsOptional()
  @IsString()
  surname?: string;

  @ApiProperty({ example: '0532 123 45 67' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Motor & Mekanik' })
  @IsOptional()
  @IsString()
  expertise?: string;
}

export class CompleteOnboardingDto {
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ example: 'bayar-oto' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '0532 123 45 67' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@bayaroto.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'Bayar Oto Servis & Ekspertiz' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Bayar Otomotiv San. ve Tic. Ltd. Şti.' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: 'İkitelli' })
  @IsOptional()
  @IsString()
  taxOffice?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ example: 'İstanbul' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Başakşehir' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'İkitelli OSB, Dolapdere Sanayi Sitesi' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  })
  @IsOptional()
  @IsArray()
  workingDays?: string[];

  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @IsString()
  workStartTime?: string;

  @ApiPropertyOptional({ example: '18:30' })
  @IsOptional()
  @IsString()
  workEndTime?: string;

  @ApiPropertyOptional({ example: '12:30' })
  @IsOptional()
  @IsString()
  breakStartTime?: string;

  @ApiPropertyOptional({ example: '13:30' })
  @IsOptional()
  @IsString()
  breakEndTime?: string;

  @ApiPropertyOptional({ type: [OnboardingServiceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingServiceItemDto)
  services?: OnboardingServiceItemDto[];

  @ApiPropertyOptional({ type: [OnboardingStaffItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingStaffItemDto)
  staff?: OnboardingStaffItemDto[];

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsNumber()
  appointmentSlotDuration?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  activeLiftCount?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  criticalStockThreshold?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoInvoiceOnComplete?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoWorkOrder?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notifyAppointmentReminder?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notifyReadyForPickup?: boolean;
}
