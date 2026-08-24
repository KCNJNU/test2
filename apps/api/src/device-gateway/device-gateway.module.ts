import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ROOT_ENV_FILE } from '../root-env';
import { ObservabilityModule } from '../observability/observability.module';
import { BuildInfoModule } from '../build-info/build-info.module';
import { DeviceGatewayService } from './device-gateway.service';
import { InboundMessageService } from './inbound-message.service';
import { MessageCompatibilityService } from './message-compatibility.service';
import { OfflineDetectorService } from './offline-detector.service';
import { OutboxPublisherService } from './outbox-publisher.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ROOT_ENV_FILE }), PrismaModule, ObservabilityModule, BuildInfoModule],
  providers: [DeviceGatewayService, InboundMessageService, MessageCompatibilityService, OfflineDetectorService, OutboxPublisherService],
  exports: [DeviceGatewayService],
})
export class DeviceGatewayModule {}
