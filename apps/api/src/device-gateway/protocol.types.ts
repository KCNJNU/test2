export const INBOUND_TOPICS = [
  'robots/+/heartbeat',
  'robots/+/telemetry',
  'robots/+/events',
  'robots/+/faults',
  'robots/+/commands/ack',
] as const;

export type InboundChannel = 'heartbeat' | 'telemetry' | 'events' | 'faults' | 'commands/ack';

export type DeviceEnvelope = {
  schemaVersion: '1.0';
  messageId: string;
  traceId?: string;
  robotId: string;
  robotSn: string;
  timestamp: number | string;
  deviceTimestamp: Date;
  sequence: bigint;
  type: string;
  payload: Record<string, unknown>;
};

export type ParsedDeviceMessage = {
  channel: InboundChannel;
  topic: string;
  envelope: DeviceEnvelope;
};

export class DeviceProtocolError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export type ProcessResult = { status: 'processed' | 'duplicate' | 'stale'; messageId: string };
