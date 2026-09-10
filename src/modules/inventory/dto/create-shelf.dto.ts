import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateShelfDto {
  @ApiProperty({ example: 'A Koridoru - Ön Takım Rafı' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'RAF-A01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'Ana Depo' })
  @IsOptional()
  @IsString()
  zone?: string;

  @ApiProperty({ example: 4, description: 'Kat / Sıra sayısı' })
  @IsInt()
  @Min(1)
  @Max(20)
  rows: number;

  @ApiProperty({ example: 6, description: 'Göz / Sütun sayısı' })
  @IsInt()
  @Min(1)
  @Max(30)
  columns: number;

  @ApiPropertyOptional({ example: 'Ön fren diskleri ve balatalar için ayrılmıştır.' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignProductCellDto {
  @ApiProperty({ example: 'd3b07384-d113-4a44-9c8a-789bb4671401' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ example: 'c1b07384-d113-4a44-9c8a-789bb4671402', nullable: true })
  @IsOptional()
  @IsString()
  shelfCellId?: string | null;
}

export class BulkAssignProductCellDto {
  @ApiProperty({ example: ['d3b07384-d113-4a44-9c8a-789bb4671401'], description: 'Taşınacak ürünlerin ID dizisi' })
  @IsArray()
  @IsString({ each: true })
  productIds: string[];

  @ApiPropertyOptional({ example: 'c1b07384-d113-4a44-9c8a-789bb4671402', nullable: true, description: 'Hedef raf hücresi ID' })
  @IsOptional()
  @IsString()
  shelfCellId?: string | null;

  @ApiPropertyOptional({ example: 's1b07384-d113-4a44-9c8a-789bb4671403', nullable: true, description: 'Hedef raf ID (hücre verilmediyse ilk göze veya rafa atar)' })
  @IsOptional()
  @IsString()
  targetShelfId?: string | null;
}

