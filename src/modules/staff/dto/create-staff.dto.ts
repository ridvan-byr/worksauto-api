import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: 'Ahmet' })
  @IsNotEmpty({ message: 'Personel adı boş bırakılamaz.' })
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Personel adı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  name: string;

  @ApiProperty({ example: 'Usta' })
  @IsNotEmpty({ message: 'Personel soyadı boş bırakılamaz.' })
  @IsString()
  @Matches(/^[a-zA-ZçÇğĞıIİiöÖşŞüÜ\s]{2,50}$/, {
    message: 'Personel soyadı yalnızca harflerden oluşmalı ve en az 2 karakter olmalıdır (rakam veya simge içeremez).',
  })
  surname: string;

  @ApiProperty({ example: '05553334455' })
  @IsNotEmpty({ message: 'Telefon numarası boş bırakılamaz.' })
  @IsString()
  @Matches(/^(?:\+90\s?|0\s?)?(?:\(5\d{2}\)|5\d{2})[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}$/, {
    message: 'Personel cep telefonu geçerli bir Türkiye GSM formatında olmalıdır (Örn: 0532 123 45 67)',
  })
  phone: string;

  @ApiProperty({ example: 'ahmet.usta@bayaroto.com', required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.TECHNICIAN })
  @IsEnum(UserRole, { message: 'Geçerli bir kullanıcı rolü seçiniz.' })
  role: UserRole;

  @ApiProperty({ example: 'Motor & Mekanik', required: false })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({ example: 'Lift 2', required: false })
  @IsOptional()
  @IsString()
  assignedLift?: string;

  @ApiProperty({ example: 8, default: 8, required: false })
  @IsOptional()
  @IsNumber()
  dailyCapacityHours?: number;
}
