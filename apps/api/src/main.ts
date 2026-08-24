import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// cookie-parser uses a CommonJS `export =` declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import { raw } from 'express';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './observability/structured-logger.service';

async function bootstrap() {
  process.env.RUNTIME_SERVICE_NAME = 'api';
  Object.defineProperty(BigInt.prototype, 'toJSON', { value(this: bigint) { return this.toString(); }, configurable: true });
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  if (process.env.DEPLOYMENT_ENVIRONMENT?.toUpperCase() === 'PRODUCTION') app.getHttpAdapter().getInstance().set('trust proxy', 2);
  app.useLogger(app.get(StructuredLoggerService));
  app.use(cookieParser());
  app.use(raw({ type: 'application/octet-stream', limit: '8mb' }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Content-Range', 'X-Part-SHA256', 'X-CSRF-Token', 'X-Request-ID', 'X-Trace-ID', 'traceparent', 'Idempotency-Key', 'Last-Event-ID', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Request-ID', 'X-Trace-ID', 'traceparent'],
  });
  app.setGlobalPrefix('api', { exclude: ['health', 'metrics', 'version'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const config = new DocumentBuilder()
    .setTitle('Cleaning Robot Recognition Data Platform')
    .setDescription('REST API for cleaning robot recognition data management.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.API_PORT ?? 3000));
}
void bootstrap();
