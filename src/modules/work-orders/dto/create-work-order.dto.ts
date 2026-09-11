import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
} from 'class-validator';

export class CreateWorkOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedMechanicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedLift?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  initialKm: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fuelLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  items?: any[];
}
