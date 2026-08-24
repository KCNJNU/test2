import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connectAsync, MqttClient } from 'mqtt';
import { readFileSync } from 'node:fs';
import { InboundMessageService } from './inbound-message.service';
import { MessageCompatibilityService } from './message-compatibility.service';
import { OfflineDetectorService } from './offline-detector.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { DeviceProtocolError, INBOUND_TOPICS } from './protocol.types';
import { MetricsService } from '../observability/metrics.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';

@Injectable()
export class DeviceGatewayService implements OnModuleDestroy {
  private readonly logger = new Logger(DeviceGatewayService.name);
  private client?: MqttClient;
  private timers: NodeJS.Timeout[] = [];
  private publishing = false;
  private detecting = false;
  private inboundQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    private readonly compatibility: MessageCompatibilityService,
    private readonly inbound: InboundMessageService,
    private readonly outbox: OutboxPublisherService,
    private readonly offline: OfflineDetectorService,
    private readonly metrics: MetricsService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {}

  async start(): Promise<boolean> {
    if (this.config.getOrThrow<string>('DEVICE_GATEWAY_ENABLED') !== 'true') {
      this.logger.warn('Device Gateway is disabled by configuration');
      return false;
    }
    const brokerUri = this.config.getOrThrow<string>('MQTT_BROKER_URI');
    const clientId = this.config.getOrThrow<string>('DEVICE_GATEWAY_MQTT_CLIENT_ID');
    const pollMs = positive(this.config.getOrThrow<string>('DEVICE_GATEWAY_POLL_MS'), 'DEVICE_GATEWAY_POLL_MS');
    const ackTimeoutMs = positive(this.config.getOrThrow<string>('COMMAND_ACK_TIMEOUT_MS'), 'COMMAND_ACK_TIMEOUT_MS');
    const unstableTimeoutMs = positive(this.config.getOrThrow<string>('ROBOT_UNSTABLE_TIMEOUT_MS'), 'ROBOT_UNSTABLE_TIMEOUT_MS');
    const offlineTimeoutMs = positive(this.config.getOrThrow<string>('ROBOT_OFFLINE_TIMEOUT_MS'), 'ROBOT_OFFLINE_TIMEOUT_MS');
    if (unstableTimeoutMs >= offlineTimeoutMs) throw new Error('ROBOT_UNSTABLE_TIMEOUT_MS must be lower than ROBOT_OFFLINE_TIMEOUT_MS');
    this.client = await connectAsync(brokerUri, mqttConnectionOptions(this.config, brokerUri, clientId));
    await this.client.subscribeAsync([...INBOUND_TOPICS], { qos: 1 });
    this.metrics.gatewayConnected.set(1);
    // MQTT preserves order on a connection; keep database transitions in that same order.
    this.client.on('message', (topic, bytes) => {
      this.inboundQueue = this.inboundQueue.then(() => this.handleMessage(topic, bytes));
    });
    this.client.on('reconnect', () => this.logger.warn('Reconnecting to MQTT broker'));
    this.client.on('offline', () => { this.metrics.gatewayConnected.set(0); this.logger.warn('MQTT connection is offline; robot-side safety remains authoritative'); });
    this.client.on('connect', () => this.metrics.gatewayConnected.set(1));
    this.client.on('error', () => this.logger.error('MQTT client error'));
    this.timers.push(setInterval(() => void this.publish(pollMs, ackTimeoutMs), pollMs));
    this.timers.push(setInterval(() => void this.detect(unstableTimeoutMs, offlineTimeoutMs), Math.min(5_000, unstableTimeoutMs)));
    this.logger.log(`Device Gateway connected and subscribed as ${clientId}`);
    return true;
  }

  async stop() {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers = [];
    if (this.client) await this.client.endAsync(false).catch(() => undefined);
    await this.inboundQueue;
    this.metrics.gatewayConnected.set(0);
    this.client = undefined;
  }

  async onModuleDestroy() { await this.stop(); }

  private async handleMessage(topic: string, bytes: Buffer) {
    try {
      const parsed = this.compatibility.parse(topic, bytes);
      const result = await this.inbound.process(parsed);
      this.metrics.gatewayInbound.inc({ channel: parsed.channel, result: result.status });
      this.structuredLogger.event('log', 'mqtt_message_processed', { robotId: parsed.envelope.robotId, messageId: result.messageId, channel: parsed.channel, result: result.status, traceId: typeof parsed.envelope.traceId === 'string' ? parsed.envelope.traceId : undefined });
      if (result.status === 'duplicate') this.logger.warn(`Duplicate inbound message ignored: robot=${parsed.envelope.robotId} message=${result.messageId}`);
      else if (result.status === 'stale') this.logger.warn(`Stale inbound message retained without state overwrite: robot=${parsed.envelope.robotId} message=${result.messageId}`);
    } catch (error) {
      const code = error instanceof DeviceProtocolError ? error.code : 'PROCESSING_FAILED';
      this.metrics.gatewayInbound.inc({ channel: channelName(topic), result: code });
      this.logger.error(`Inbound MQTT message rejected: topic=${topic} code=${code}`);
    }
  }

  private async publish(_pollMs: number, ackTimeoutMs: number) {
    if (!this.client || this.publishing) return;
    this.publishing = true;
    try {
      for (let count = 0; count < 20 && await this.outbox.publishNext(this.client); count += 1) this.metrics.gatewayCommands.inc({ result: 'processed' });
      const timedOut = await this.outbox.markAckTimeouts(ackTimeoutMs);
      if (timedOut.count) this.metrics.gatewayCommands.inc({ result: 'timeout' }, timedOut.count);
    } catch { this.logger.error('Command outbox publish attempt failed'); }
    finally { this.publishing = false; }
  }

  private async detect(unstableTimeoutMs: number, offlineTimeoutMs: number) {
    if (this.detecting) return;
    this.detecting = true;
    try {
      const result = await this.offline.detect(unstableTimeoutMs, offlineTimeoutMs);
      if (result.offline) this.metrics.offlineTransitions.inc({ status: 'offline' }, result.offline);
      if (result.unstable) this.metrics.offlineTransitions.inc({ status: 'unstable' }, result.unstable);
    }
    catch { this.logger.error('Robot offline detection failed'); }
    finally { this.detecting = false; }
  }
}

export function mqttConnectionOptions(config: ConfigService, brokerUri: string, clientId: string) {
  const production = config.get<string>('DEPLOYMENT_ENVIRONMENT')?.toUpperCase() === 'PRODUCTION';
  const base = { clientId, clean: false, reconnectPeriod: 2_000, connectTimeout: 5_000 };
  if (!production) return { ...base, username: config.get<string>('MQTT_GATEWAY_USERNAME'), password: config.get<string>('MQTT_GATEWAY_PASSWORD') };
  if (!brokerUri.startsWith('mqtts://')) throw new Error('Production Device Gateway requires MQTT TLS');
  if (clientId !== 'device-gateway') throw new Error('Production Device Gateway client ID must match its certificate identity');
  if (config.get<string>('MQTT_GATEWAY_USERNAME') || config.get<string>('MQTT_GATEWAY_PASSWORD')) throw new Error('Production Device Gateway does not permit password authentication');
  if (config.get<string>('MQTT_TLS_REJECT_UNAUTHORIZED') !== 'true') throw new Error('Production Device Gateway requires server certificate verification');
  const caFile = config.getOrThrow<string>('MQTT_TLS_CA_FILE');
  const certFile = config.getOrThrow<string>('MQTT_TLS_CERT_FILE');
  const keyFile = config.getOrThrow<string>('MQTT_TLS_KEY_FILE');
  const servername = config.getOrThrow<string>('MQTT_TLS_SERVER_NAME');
  return { ...base, ca: readFileSync(caFile), cert: readFileSync(certFile), key: readFileSync(keyFile), servername, rejectUnauthorized: true };
}

function channelName(topic: string) {
  const final = topic.split('/').at(-1);
  return final && ['heartbeat', 'telemetry', 'event', 'fault', 'ack'].includes(final) ? final : 'unknown';
}

function positive(value: string, name: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a positive number`);
  return number;
}
