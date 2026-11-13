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

  const databaseUrl = new URL(process.env.DATABASE_URL as string);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Production DATABASE_URL must use PostgreSQL');
  }

  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const invalidOrigins = origins.filter((origin) => {
    try {
      const parsed = new URL(origin);
      return (
        parsed.protocol !== 'https:' ||
        parsed.origin !== origin ||
        parsed.hostname.includes('*') ||
        Boolean(parsed.username || parsed.password)
      );
    } catch {
      return true;
    }
  });
  if (origins.length === 0 || invalidOrigins.length > 0) {
    throw new Error(
      'Production CORS_ORIGINS must contain exact HTTPS origins without wildcards, paths, or credentials.',
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

  const swaggerEnabled = process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';
  app.use(
    helmet({
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
      strictTransportSecurity:
        process.env.NODE_ENV === 'production' ? undefined : false,
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
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  app.enableShutdownHooks();
  await app.listen(port);
  logger.log(`Omran Mall API listening on port ${port}`);
}
bootstrap();
