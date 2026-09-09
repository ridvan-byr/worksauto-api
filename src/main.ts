import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { getAllowedOrigins } from './shared/constants/cors.constants';

async function bootstrap() {
  const logger = new Logger('WorksAutoBootstrap');

  // 0. Fail-Fast Environment & Security Verification
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET ortam değişkeni zorunludur! Uygulama başlatılamaz.');
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.includes('super_secret_jwt_key_2026_production_grade')) {
      throw new Error('FATAL: Üretim ortamında varsayılan JWT_SECRET kullanılamaz! Lütfen rastgele ve güçlü bir anahtar tanımlayınız.');
    }
    if (process.env.ENABLE_DEV_OTP_BYPASS === 'true') {
      throw new Error('FATAL: Üretim ortamında geliştirici OTP bypass anahtarı (ENABLE_DEV_OTP_BYPASS) aktif edilemez!');
    }
  }

  const app = await NestFactory.create(AppModule);

  // 1. HTTP Security Headers via Helmet
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // 2. CORS Configuration for Next.js Web App
  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Idempotency-Key, X-Tenant-Id, X-Health-Token',
  });

  // 3. Cookie Parser Middleware (For Secure httpOnly Refresh Tokens)
  app.use(cookieParser());

  // 3. Global Request Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 5. API Prefix
  app.setGlobalPrefix('api/v1');

  // 6. Swagger / OpenAPI Documentation (Restricted to non-production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WorksAuto Enterprise API')
      .setDescription('Multi-Tenant Cloud ERP & Workshop Management System REST API')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Bearer token giriniz',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('📚 Swagger Docs available at: /api/docs');
  } else {
    logger.log('🔒 Swagger Docs disabled in production mode for security hardening.');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 WorksAuto API is running on: http://localhost:${port}/api/v1`);
}

bootstrap();
