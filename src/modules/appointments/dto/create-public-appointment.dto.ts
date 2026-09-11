import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePublicAppointmentDto {
  @ApiProperty({ example: 'Ahmet Yılmaz', description: 'Müşteri Ad Soyad' })
  @IsNotEmpty({ message: 'Ad Soyad girilmelidir' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: '05321234567', description: 'Müşteri Telefon' })
  @IsNotEmpty({ message: 'Telefon girilmelidir' })
  @IsString()
  customerPhone: string;

  @ApiProperty({ example: '34ABC123', description: 'Araç Plakası' })
  @IsNotEmpty({ message: 'Plaka girilmelidir' })
  @IsString()
  plate: string;

  @ApiPropertyOptional({ example: 'BMW 320i', description: 'Marka ve Model' })
  @IsOptional()
  @IsString()
  brandModel?: string;

  @ApiPropertyOptional({
    example: 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    description: 'Hizmet ID',
  })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ example: '2026-09-12', description: 'Randevu Tarihi' })
  @IsNotEmpty()
  @IsString()
  slotDate: string;

  @ApiProperty({
    example: '2026-09-12T10:00:00.000Z',
    description: 'Başlangıç Saati (ISO)',
  })
  @IsNotEmpty()
  @IsString()
  slotStartTime: string;

  @ApiProperty({
    example: '2026-09-12T11:00:00.000Z',
    description: 'Bitiş Saati (ISO)',
  })
  @IsNotEmpty()
  @IsString()
  slotEndTime: string;

  @ApiPropertyOptional({
    example: 'Periyodik bakım yapılacak',
    description: 'Notlar',
  })
  @IsOptional()
  @IsString()
  customerNotes?: string;
}
