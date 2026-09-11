import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminTenantService } from './services/admin-tenant.service';
import { AdminMetricsService } from './services/admin-metrics.service';
import { AdminUsersService } from './services/admin-users.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { RedisService } from '../../shared/infrastructure/redis/redis.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AdminController],
  providers: [
    AdminAuthService,
    AdminTenantService,
    AdminMetricsService,
    AdminUsersService,
    PrismaService,
    RedisService,
  ],
  exports: [
    AdminAuthService,
    AdminTenantService,
    AdminMetricsService,
    AdminUsersService,
  ],
})
export class AdminModule {}
