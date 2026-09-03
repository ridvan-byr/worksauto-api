import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('WorksAutoBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. CORS Configuration for Next.js Web App
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://worksauto.local',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Idempotency-Key, X-Tenant-Id',
  });

  // 2. Global Request Validation
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

  // 3. Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 4. API Prefix
  app.setGlobalPrefix('api/v1');

  // 5. Swagger / OpenAPI Documentation
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

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 WorksAuto API is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger Docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
