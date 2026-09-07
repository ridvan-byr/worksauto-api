import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', description: 'Müşteri ID' })
  @IsNotEmpty({ message: 'Müşteri seçilmelidir' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: 'v0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', description: 'Araç ID' })
  @IsNotEmpty({ message: 'Araç seçilmelidir' })
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional({ example: 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', description: 'Hizmet ID' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ example: 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', description: 'Atanan Usta ID' })
  @IsOptional()
  @IsString()
  assignedMechanicId?: string;

  @ApiPropertyOptional({ example: 'Lift 1 (Mekanik)', description: 'Atanan Lift' })
  @IsOptional()
  @IsString()
  assignedLift?: string;

  @ApiProperty({ example: '2026-09-12', description: 'Randevu Günü (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsString()
  slotDate: string;

  @ApiProperty({ example: '2026-09-12T09:00:00.000Z', description: 'Başlangıç Saati (ISO)' })
  @IsNotEmpty()
  @IsString()
  slotStartTime: string;

  @ApiProperty({ example: '2026-09-12T10:00:00.000Z', description: 'Bitiş Saati (ISO)' })
  @IsNotEmpty()
  @IsString()
  slotEndTime: string;

  @ApiPropertyOptional({ example: 'Ön frenlerden ses geliyor', description: 'Müşteri Notu' })
  @IsOptional()
  @IsString()
  customerNotes?: string;
}
