import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = ['DATABASE_URL', 'CORS_ORIGINS'].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      'Missing required production configuration: ' + missing.join(', '),
    );
  }

  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    origins.length === 0 ||
    origins.some((origin) => origin === '*' || !/^https:\/\//i.test(origin))
  ) {
    throw new Error(
      'Production CORS_ORIGINS must contain explicit HTTPS origins; wildcard and HTTP origins are forbidden.',
    );
  }
}

async function bootstrap() {
  validateProductionConfig();
  const logger = new Logger('OmranMallBootstrap');
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowedOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  const config = new DocumentBuilder()
    .setTitle('Omran Mall Enterprise API')
    .setDescription('نظام عمران مول المتكامل لإدارة الموظفين والعمليات التشغيلية للفروع')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT || 4000);
  app.enableShutdownHooks();
  await app.listen(port);
  logger.log(`Omran Mall API listening on port ${port}`);
}
bootstrap();
