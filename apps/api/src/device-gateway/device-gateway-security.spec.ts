import { ConfigService } from '@nestjs/config';
import { mqttConnectionOptions } from './device-gateway.service';

describe('Device Gateway production transport policy', () => {
  const config = (values: Record<string, string | undefined>) => ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => { const value = values[key]; if (!value) throw new Error(`${key} missing`); return value; },
  }) as unknown as ConfigService;

  it('allows the existing password transport outside production', () => {
    expect(mqttConnectionOptions(config({ MQTT_GATEWAY_USERNAME: 'dev', MQTT_GATEWAY_PASSWORD: 'dev' }), 'mqtt://localhost:1883', 'dev-gateway')).toEqual(expect.objectContaining({ username: 'dev' }));
  });

  it('rejects plaintext, password auth, identity mismatch, and disabled certificate checks in production', () => {
    const base = { DEPLOYMENT_ENVIRONMENT: 'PRODUCTION', MQTT_TLS_REJECT_UNAUTHORIZED: 'true' };
    expect(() => mqttConnectionOptions(config(base), 'mqtt://broker:1883', 'device-gateway')).toThrow('requires MQTT TLS');
    expect(() => mqttConnectionOptions(config({ ...base, MQTT_GATEWAY_USERNAME: 'legacy' }), 'mqtts://broker:8883', 'device-gateway')).toThrow('does not permit password');
    expect(() => mqttConnectionOptions(config(base), 'mqtts://broker:8883', 'wrong')).toThrow('client ID');
    expect(() => mqttConnectionOptions(config({ ...base, MQTT_TLS_REJECT_UNAUTHORIZED: 'false' }), 'mqtts://broker:8883', 'device-gateway')).toThrow('verification');
  });
});
