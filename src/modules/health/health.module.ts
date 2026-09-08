import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [HealthController],
  providers: [HealthService, PrismaService, RedisService],
  exports: [HealthService],
})
export class HealthModule {}
