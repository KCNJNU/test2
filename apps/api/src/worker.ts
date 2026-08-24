import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkerRunnerService } from './worker/worker-runner.service';
import { StructuredLoggerService } from './observability/structured-logger.service';

async function bootstrap() {
  process.env.RUNTIME_SERVICE_NAME = 'worker';
  const context = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  context.useLogger(context.get(StructuredLoggerService));
  try { await context.get(WorkerRunnerService).start(); }
  finally { await context.close(); }
}
void bootstrap();
