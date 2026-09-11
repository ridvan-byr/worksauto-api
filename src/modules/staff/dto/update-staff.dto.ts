import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateStaffDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Personel adı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Personel soyadı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  surname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+90\s?|0\s?)?(?:\(5\d{2}\)|5\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}$/, {
    message: 'Personel cep telefonu geçerli bir Türkiye GSM formatında olmalıdır (Örn: 0532 123 45 67)',
  })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedLift?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  dailyCapacityHours?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
