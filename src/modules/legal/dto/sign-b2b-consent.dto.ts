import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SignB2bConsentDto {
  @ApiProperty({
    example: true,
    description: 'WorksAuto B2B SaaS Hizmet ve Lisans Sözleşmesi kabul edildi mi?',
  })
  @IsBoolean()
  @IsNotEmpty()
  saasTermsAccepted: boolean;

  @ApiProperty({
    example: true,
    description: 'KVKK Veri İşleme ve Gizlilik Taahhütnamesi kabul edildi mi?',
  })
  @IsBoolean()
  @IsNotEmpty()
  dataProcessingAccepted: boolean;

  @ApiProperty({
    example: true,
    description: 'Platform operasyonel duyuru ve fatura bildirimleri izni',
  })
  @IsBoolean()
  marketingAccepted: boolean;
}
