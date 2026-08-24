import { DeviceProtocolError } from './protocol.types';
import { MessageCompatibilityService } from './message-compatibility.service';

describe('MessageCompatibilityService', () => {
  const service = new MessageCompatibilityService();
  const robotId = '11111111-1111-4111-8111-111111111111';
  const envelope = (overrides: Record<string, unknown> = {}) => Buffer.from(JSON.stringify({
    schemaVersion: '1.0', messageId: 'MSG-1', robotId, robotSn: 'CR-001', timestamp: 1_786_000_000_000,
    sequence: 42, type: 'heartbeat', payload: { state: 'READY' }, ...overrides,
  }));

  it('validates the v1 envelope and converts sequence and device time', () => {
    const result = service.parse(`robots/${robotId}/heartbeat`, envelope());
    expect(result.channel).toBe('heartbeat');
    expect(result.envelope.sequence).toBe(42n);
    expect(result.envelope.deviceTimestamp).toBeInstanceOf(Date);
  });

  it.each([
    ['UNKNOWN_SCHEMA_VERSION', { schemaVersion: '2.0' }],
    ['IDENTITY_MISMATCH', { robotId: '22222222-2222-4222-8222-222222222222' }],
    ['INVALID_SEQUENCE', { sequence: -1 }],
    ['TYPE_NOT_SUPPORTED', { type: 'fault_event' }],
    ['INVALID_TRACE_ID', { traceId: 'secret-or-malformed' }],
  ])('rejects incompatible messages with %s', (code, override) => {
    expect(() => service.parse(`robots/${robotId}/heartbeat`, envelope(override))).toThrow(expect.objectContaining({ code }));
  });

  it('preserves a valid optional trace identifier for MQTT correlation', () => {
    const result = service.parse(`robots/${robotId}/heartbeat`, envelope({ traceId: 'ABCDEF0123456789ABCDEF0123456789' }));
    expect(result.envelope.traceId).toBe('abcdef0123456789abcdef0123456789');
  });

  it('rejects malformed JSON without returning the raw input', () => {
    try { service.parse(`robots/${robotId}/heartbeat`, Buffer.from('{secret')); }
    catch (error) {
      expect(error).toBeInstanceOf(DeviceProtocolError);
      expect((error as Error).message).not.toContain('secret');
    }
  });
});
