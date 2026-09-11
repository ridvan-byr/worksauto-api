import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MediaController],
  providers: [MediaService, PrismaService],
  exports: [MediaService],
})
export class MediaModule {}
