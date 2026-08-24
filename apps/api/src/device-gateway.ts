import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DeviceGatewayModule } from './device-gateway/device-gateway.module';
import { DeviceGatewayService } from './device-gateway/device-gateway.service';
import { StructuredLoggerService } from './observability/structured-logger.service';

async function bootstrap() {
  process.env.RUNTIME_SERVICE_NAME = 'device-gateway';
  const app = await NestFactory.create(DeviceGatewayModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLoggerService));
  const gateway = app.get(DeviceGatewayService);
  if (!await gateway.start()) {
    await app.close();
    return;
  }
  const config = app.get(ConfigService);
  await app.listen(Number(config.getOrThrow<string>('DEVICE_GATEWAY_METRICS_PORT')), config.getOrThrow<string>('DEVICE_GATEWAY_METRICS_HOST'));
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void gateway.stop().finally(() => app.close());
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
void bootstrap();
