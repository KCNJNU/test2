import { Injectable } from '@nestjs/common';
import { DeviceEnvelope, DeviceProtocolError, InboundChannel, ParsedDeviceMessage } from './protocol.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOPIC = /^robots\/([^/]+)\/(heartbeat|telemetry|events|faults|commands\/ack)$/;
const TYPES: Record<InboundChannel, ReadonlySet<string>> = {
  heartbeat: new Set(['heartbeat']),
  telemetry: new Set(['telemetry']),
  events: new Set(['task_event', 'robot_state', 'maintenance_event', 'ota_status']),
  faults: new Set(['fault_event']),
  'commands/ack': new Set(['command_ack']),
};

@Injectable()
export class MessageCompatibilityService {
  parse(topic: string, bytes: Buffer): ParsedDeviceMessage {
    const topicMatch = TOPIC.exec(topic);
    if (!topicMatch) throw new DeviceProtocolError('TOPIC_NOT_SUPPORTED', 'Inbound topic is not supported');
    const topicRobotId = topicMatch[1];
    const channel = topicMatch[2] as InboundChannel;
    let value: unknown;
    try { value = JSON.parse(bytes.toString('utf8')); }
    catch { throw new DeviceProtocolError('INVALID_JSON', 'Message is not valid JSON'); }
    if (!isRecord(value)) throw new DeviceProtocolError('INVALID_ENVELOPE', 'Message envelope must be an object');
    if (value.schemaVersion !== '1.0') throw new DeviceProtocolError('UNKNOWN_SCHEMA_VERSION', 'Schema version is not supported');
    if (typeof value.messageId !== 'string' || value.messageId.length < 1 || value.messageId.length > 128) throw new DeviceProtocolError('INVALID_MESSAGE_ID', 'messageId is invalid');
    if (value.traceId !== undefined && (typeof value.traceId !== 'string' || !/^[0-9a-f]{32}$/i.test(value.traceId))) throw new DeviceProtocolError('INVALID_TRACE_ID', 'traceId must be 32 hexadecimal characters');
    if (typeof value.robotId !== 'string' || !UUID.test(value.robotId)) throw new DeviceProtocolError('INVALID_ROBOT_ID', 'robotId must be a UUID');
    if (value.robotId !== topicRobotId) throw new DeviceProtocolError('IDENTITY_MISMATCH', 'Topic robotId does not match message robotId');
    if (typeof value.robotSn !== 'string' || value.robotSn.length < 1 || value.robotSn.length > 128) throw new DeviceProtocolError('INVALID_ROBOT_SN', 'robotSn is required');
    if (typeof value.type !== 'string' || !TYPES[channel].has(value.type)) throw new DeviceProtocolError('TYPE_NOT_SUPPORTED', 'Message type is not valid for the topic');
    if (!isRecord(value.payload)) throw new DeviceProtocolError('INVALID_PAYLOAD', 'payload must be an object');
    const sequence = parseSequence(value.sequence);
    const deviceTimestamp = parseTimestamp(value.timestamp);
    const envelope: DeviceEnvelope = {
      schemaVersion: '1.0', messageId: value.messageId, traceId: typeof value.traceId === 'string' ? value.traceId.toLowerCase() : undefined, robotId: value.robotId, robotSn: value.robotSn,
      timestamp: value.timestamp as number | string, deviceTimestamp, sequence, type: value.type, payload: value.payload,
    };
    return { channel, topic, envelope };
  }
}

function parseSequence(value: unknown): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new DeviceProtocolError('INVALID_SEQUENCE', 'sequence must be a non-negative integer');
}

function parseTimestamp(value: unknown): Date {
  if (typeof value !== 'number' && typeof value !== 'string') throw new DeviceProtocolError('INVALID_TIMESTAMP', 'timestamp is invalid');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new DeviceProtocolError('INVALID_TIMESTAMP', 'timestamp is invalid');
  return date;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
