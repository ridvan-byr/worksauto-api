import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingServiceItemDto {
  @ApiPropertyOptional({ example: 'srv_1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Periyodik Bakım (Yağ + 4 Filtre)' })
  @IsString()
  @Matches(/^[a-zA-Z0-9çÇğĞıIİiöÖşŞüÜ\s\(\)\+\-\/\.]{2,100}$/, {
    message: 'Hizmet adı en az 2 karakter olmalı ve geçerli bir başlık olmalıdır.',
  })
  name: string;

  @ApiPropertyOptional({ example: 'Periyodik Bakım' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 60 })
  @IsNumber()
  @Min(5, { message: 'Hizmet süresi en az 5 dakika olmalıdır.' })
  @Max(1440, { message: 'Hizmet süresi en fazla 1440 dakika olabilir.' })
  durationMinutes: number;

  @ApiProperty({ example: 1250 })
  @IsNumber()
  @Min(0, { message: 'İşçilik ücreti 0 veya pozitif bir değer olmalıdır.' })
  laborPrice: number;
}

export class OnboardingStaffItemDto {
  @ApiPropertyOptional({ example: 'st_1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Ahmet' })
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Usta adı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  name: string;

  @ApiPropertyOptional({ example: 'Usta' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Usta soyadı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  surname?: string;

  @ApiProperty({ example: '0532 123 45 67' })
  @IsString()
  @Matches(/^(?:\+90\s?|0\s?)?(?:\(5\d{2}\)|5\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}$/, {
    message: 'Usta cep telefonu geçerli bir Türkiye GSM formatında olmalıdır (Örn: 0532 123 45 67)',
  })
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
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Vergi dairesi yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır.',
  })
  taxOffice?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Vergi Numarası 10 haneli VKN veya 11 haneli TCKN olmalıdır.',
  })
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
  @Min(15, { message: 'Randevu slot periyodu en az 15 dakika olmalıdır.' })
  @Max(240, { message: 'Randevu slot periyodu en fazla 240 dakika olabilir.' })
  appointmentSlotDuration?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Aktif lift kapasitesi en az 1 olmalıdır.' })
  activeLiftCount?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Kritik stok eşiği en az 1 olmalıdır.' })
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
