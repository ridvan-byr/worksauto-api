import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
} from 'class-validator';
import { NotificationStrategy, NotificationChannel } from '@prisma/client';

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    enum: NotificationStrategy,
    example: NotificationStrategy.FALLBACK,
    description:
      'Gönderim stratejisi: FALLBACK (sırayla dene), BROADCAST (hepsine gönder), SINGLE (tek kanal)',
  })
  @IsEnum(NotificationStrategy)
  strategy: NotificationStrategy;

  @ApiProperty({
    isArray: true,
    enum: NotificationChannel,
    example: [
      NotificationChannel.WHATSAPP,
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
    ],
    description: 'Kanal öncelik sırası',
  })
  @IsArray()
  channelPriority: NotificationChannel[];

  @ApiProperty({
    enum: NotificationChannel,
    required: false,
    example: NotificationChannel.WHATSAPP,
    description: 'SINGLE stratejisi seçildiğinde kullanılacak tekil kanal',
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  singleChannel?: NotificationChannel;

  @ApiProperty({ example: true, description: 'WhatsApp kanalı aktif mi?' })
  @IsBoolean()
  whatsappEnabled: boolean;

  @ApiProperty({ example: true, description: 'E-posta kanalı aktif mi?' })
  @IsBoolean()
  emailEnabled: boolean;

  @ApiProperty({ example: false, description: 'SMS kanalı aktif mi?' })
  @IsBoolean()
  smsEnabled: boolean;

  @ApiProperty({
    required: false,
    example: 'bayaroto-wa-device-1',
    description: 'GOWA WhatsApp Cihaz ID',
  })
  @IsOptional()
  @IsString()
  whatsappDeviceId?: string;
}
