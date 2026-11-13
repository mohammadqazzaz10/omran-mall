import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('OmranMallBootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: '*', // Restrict to trusted domains in production
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global API prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Omran Mall Enterprise API')
    .setDescription('نظام عمران مول المتكامل لإدارة الموظفين والعمليات التشغيلية للفروع')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Omran Mall API is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 OpenAPI Documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
