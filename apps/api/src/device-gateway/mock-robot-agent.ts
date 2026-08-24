import { Logger } from '@nestjs/common';
import { connectAsync, MqttClient } from 'mqtt';
import { randomUUID } from 'node:crypto';

export type MockScenario =
  | 'ONLINE' | 'OFFLINE' | 'READY' | 'RUNNING' | 'PAUSED' | 'BLOCKED'
  | 'SAFE-101' | 'SAFE-106' | 'SAFE-202' | 'SAFE-301'
  | 'ACK_ACCEPT' | 'ACK_REJECT' | 'TIMEOUT' | 'MAP_VERSION_MISMATCH'
  | 'RECONNECT' | 'OUT_OF_ORDER' | 'DUPLICATE_EVENT'
  | 'OTA_SUCCESS' | 'OTA_CHECKSUM_FAILURE' | 'OTA_BOOT_FAILURE';

export type OtaSimulationStep = { status: string; progress: number; reasonCode?: string };

export class MockRobotAgent {
  private readonly logger = new Logger(MockRobotAgent.name);
  private client?: MqttClient;
  private sequence = 0;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly brokerUri: string,
    private readonly robotId: string,
    private readonly robotSn: string,
    private readonly scenario: MockScenario,
  ) {}

  async start() {
    await this.connect();
    await this.runScenario();
    if (!['OFFLINE', 'RECONNECT'].includes(this.scenario)) {
      this.heartbeat = setInterval(() => void this.publishHeartbeat(this.stateForScenario()), 5_000);
    }
    this.logger.log(`Simulation / Development agent started: robot=${this.robotId} scenario=${this.scenario}`);
  }

  async stop() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.client) await this.client.endAsync(false).catch(() => undefined);
    this.client = undefined;
  }

  private async connect() {
    this.client = await connectAsync(this.brokerUri, {
      clientId: `mock-robot-${this.robotId}-${randomUUID().slice(0, 8)}`, clean: true, reconnectPeriod: 1_000, connectTimeout: 5_000,
    });
    await this.client.subscribeAsync(`robots/${this.robotId}/commands`, { qos: 1 });
    this.client.on('message', (_topic, bytes) => void this.onCommand(bytes));
  }

  private async runScenario() {
    if (this.scenario === 'OUT_OF_ORDER') {
      this.sequence = 2; await this.publishHeartbeat('RUNNING');
      this.sequence = 0; await this.publishHeartbeat('READY');
      return;
    }
    if (this.scenario === 'DUPLICATE_EVENT') {
      const envelope = this.envelope('robot_state', { state: 'READY', simulation: true }, 1, 'MOCK-DUPLICATE-EVENT');
      await this.publish('events', envelope); await this.publish('events', envelope);
      return;
    }
    if (this.scenario.startsWith('SAFE-')) {
      await this.publishHeartbeat('BLOCKED');
      await this.publish('faults', this.envelope('fault_event', { safeCode: this.scenario, occurredAt: Date.now(), simulation: true }));
      return;
    }
    if (this.scenario === 'RECONNECT') {
      await this.publishHeartbeat('READY');
      await this.client?.endAsync(false);
      this.client = undefined;
      setTimeout(() => void this.connect().then(() => this.publishHeartbeat('READY')), 1_000);
      return;
    }
    await this.publishHeartbeat(this.stateForScenario());
    if (this.scenario === 'OFFLINE') {
      await this.client?.endAsync(false);
      this.client = undefined;
    }
  }

  private async onCommand(bytes: Buffer) {
    let command: Record<string, unknown>;
    try { command = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>; }
    catch { return; }
    const commandId = typeof command.commandId === 'string' ? command.commandId : undefined;
    if (!commandId || this.scenario === 'TIMEOUT') return;
    if (this.scenario === 'ACK_REJECT' || this.scenario === 'MAP_VERSION_MISMATCH') {
      await this.ack(commandId, 'REJECTED', this.scenario === 'MAP_VERSION_MISMATCH' ? 'MAP_VERSION_MISMATCH' : 'SIMULATED_REJECTION');
      return;
    }
    await this.ack(commandId, 'ACCEPTED');
    if ((command.type === 'SOFTWARE_UPDATE' || command.type === 'CONFIG_APPLY') && this.scenario.startsWith('OTA_')) {
      const payload = record(command.payload);
      const otaJobId = typeof payload.otaJobId === 'string' ? payload.otaJobId : undefined;
      if (!otaJobId) {
        await this.ack(commandId, 'FAILED', 'OTA_JOB_ID_MISSING');
        return;
      }
      for (const step of otaScenarioSteps(this.scenario)) {
        await this.publish('events', this.envelope('ota_status', { otaJobId, ...step, simulation: true }));
      }
      const last = otaScenarioSteps(this.scenario).at(-1);
      await this.ack(commandId, last?.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED', last?.reasonCode);
      return;
    }
    if (this.scenario === 'ACK_ACCEPT' || typeof command.type !== 'string') return;
    const state = commandState(command.type);
    if (state) await this.publish('events', this.envelope('robot_state', { state, commandId, simulation: true }));
  }

  private async ack(commandId: string, status: string, failureCode?: string) {
    await this.publish('commands/ack', this.envelope('command_ack', {
      commandId, status, failureCode, failureMessage: failureCode ? 'Rejected by the development simulator' : undefined, simulation: true,
    }));
  }

  private publishHeartbeat(state: string) {
    return this.publish('heartbeat', this.envelope('heartbeat', {
      state, robotSn: this.robotSn, batteryPercent: 82, chargingState: 'NOT_CHARGING',
      softwareVersion: 'mock-1.0.0', configVersion: 'mock-config-1', simulation: true,
    }));
  }

  private envelope(type: string, payload: Record<string, unknown>, sequence?: number, messageId?: string) {
    return {
      schemaVersion: '1.0', messageId: messageId ?? `MOCK-${randomUUID()}`, robotId: this.robotId, robotSn: this.robotSn,
      timestamp: Date.now(), sequence: sequence ?? ++this.sequence, type, payload,
    };
  }

  private async publish(channel: string, envelope: Record<string, unknown>) {
    if (!this.client) return;
    await this.client.publishAsync(`robots/${this.robotId}/${channel}`, JSON.stringify(envelope), { qos: 1 });
  }

  private stateForScenario() {
    if (['READY', 'RUNNING', 'PAUSED', 'BLOCKED'].includes(this.scenario)) return this.scenario;
    return 'IDLE';
  }
}

export function otaScenarioSteps(scenario: MockScenario): readonly OtaSimulationStep[] {
  const prefix: OtaSimulationStep[] = [
    { status: 'DOWNLOADING', progress: 10 },
    { status: 'VERIFYING', progress: 35 },
  ];
  if (scenario === 'OTA_CHECKSUM_FAILURE') {
    return [...prefix, { status: 'FAILED', progress: 35, reasonCode: 'CHECKSUM_MISMATCH' }];
  }
  const install: OtaSimulationStep[] = [
    ...prefix,
    { status: 'INSTALLING', progress: 55 },
    { status: 'REBOOTING', progress: 75 },
  ];
  if (scenario === 'OTA_BOOT_FAILURE') {
    return [...install,
      { status: 'FAILED', progress: 75, reasonCode: 'BOOT_HEALTH_CHECK_FAILED' },
      { status: 'ROLLED_BACK', progress: 100, reasonCode: 'AUTOMATIC_ROLLBACK' },
    ];
  }
  return [...install, { status: 'VALIDATING', progress: 90 }, { status: 'SUCCEEDED', progress: 100 }];
}

function commandState(type: string) {
  if (type === 'MISSION_START' || type === 'MISSION_RESUME') return 'RUNNING';
  if (type === 'MISSION_PAUSE') return 'PAUSED';
  if (type === 'MISSION_CANCEL' || type === 'RETURN_TO_STANDBY') return 'READY';
  if (type === 'RETURN_TO_CHARGE') return 'RETURNING';
  if (type === 'SOFTWARE_UPDATE' || type === 'CONFIG_APPLY') return 'UPGRADING';
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
