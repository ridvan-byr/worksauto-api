import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateStaffLeaveDto {
  @ApiProperty({
    example: 'd3b07384-d113-49d9-bb42-53b92f7e7f12',
    description: 'İzin alan personelin IDsi',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: LeaveType,
    default: LeaveType.ANNUAL,
    description: 'İzin türü (ANNUAL, SICK, COMPASSIONATE, UNPAID, OTHER)',
  })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({
    example: '2026-09-20',
    description: 'İzin başlangıç tarihi (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    example: '2026-09-25',
    description: 'İzin bitiş tarihi (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({ example: 5, description: 'Toplam gün sayısı' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  totalDays?: number;

  @ApiPropertyOptional({
    example: 'Yıllık izin kullanımı',
    description: 'İzin gerekçesi / açıklaması',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
