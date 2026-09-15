import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [EventsGateway, PrismaService],
  exports: [EventsGateway],
})
export class EventsModule {}
