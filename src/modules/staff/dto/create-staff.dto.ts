import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: 'Ahmet' })
  @IsNotEmpty({ message: 'Personel adı boş bırakılamaz.' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Usta' })
  @IsNotEmpty({ message: 'Personel soyadı boş bırakılamaz.' })
  @IsString()
  surname: string;

  @ApiProperty({ example: '05553334455' })
  @IsNotEmpty({ message: 'Telefon numarası boş bırakılamaz.' })
  @IsString()
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
