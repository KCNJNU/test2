import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns the health service report', async () => {
    const report = {
      status: 'healthy' as const, timestamp: '2026-08-14T12:00:00.000Z',
      services: {
        api: { status: 'healthy' as const, message: 'Responding normally' },
        postgresql: { status: 'healthy' as const, message: 'Database connection successful' },
        redis: { status: 'healthy' as const, provider: 'redis', message: 'Redis PING successful' },
        mqtt: { status: 'healthy' as const, provider: 'emqx', message: 'MQTT CONNECT successful' },
        objectStorage: { status: 'healthy' as const, provider: 'minio', bucket: 'raw', message: 'Bucket reachable' },
        messageQueue: { status: 'healthy' as const, provider: 'postgresql', message: 'PostgreSQL job queue reachable' },
        dvcRemote: { status: 'healthy' as const, provider: 's3-compatible', bucket: 'dvc', message: 'DVC remote reachable' },
        worker: { status: 'healthy' as const, message: 'Worker heartbeat received 1s ago' },
      },
    };
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController], providers: [{ provide: HealthService, useValue: { check: jest.fn().mockResolvedValue(report) } }] }).compile();
    await expect(moduleRef.get(HealthController).getHealth()).resolves.toEqual(report);
  });
});
