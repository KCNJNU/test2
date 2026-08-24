import { ConfigService } from '@nestjs/config';
import { connectAsync } from 'mqtt';
import { createClient } from 'redis';
import { HealthService } from './health.service';

jest.mock('mqtt', () => ({ connectAsync: jest.fn() }));
jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    job: { count: jest.fn() },
    workerHeartbeat: { findFirst: jest.fn() },
    deviceCertificate: { count: jest.fn() },
    backupEvidence: { findFirst: jest.fn() },
    restoreDrill: { findFirst: jest.fn() },
  };
  const storage = { checkHealth: jest.fn() };
  const dvc = { checkRemoteHealth: jest.fn() };
  const config = {
    get: jest.fn(() => undefined),
    getOrThrow: jest.fn((key: string) => ({
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      MQTT_BROKER_URI: 'tcp://user:secret@localhost:1883',
    })[key]),
  };
  const redisClient = {
    on: jest.fn(), connect: jest.fn(), ping: jest.fn(), quit: jest.fn(), destroy: jest.fn(), isOpen: true,
  };
  const mqttClient = { endAsync: jest.fn() };
  const service = new HealthService(prisma as never, storage as never, dvc as never, config as unknown as ConfigService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    prisma.job.count.mockResolvedValue(0);
    prisma.workerHeartbeat.findFirst.mockResolvedValue({ heartbeatAt: new Date() });
    prisma.deviceCertificate.count.mockResolvedValue(1);
    prisma.backupEvidence.findFirst.mockResolvedValue(null);
    prisma.restoreDrill.findFirst.mockResolvedValue(null);
    storage.checkHealth.mockResolvedValue({ provider: 'minio', bucket: 'robot-raw-files', reachable: true });
    dvc.checkRemoteHealth.mockResolvedValue({ configured: true, provider: 's3-compatible', bucket: 'robot-dvc-store', reachable: true });
    redisClient.connect.mockResolvedValue(redisClient);
    redisClient.ping.mockResolvedValue('PONG');
    redisClient.quit.mockResolvedValue('OK');
    jest.mocked(createClient).mockReturnValue(redisClient as never);
    mqttClient.endAsync.mockResolvedValue(undefined);
    jest.mocked(connectAsync).mockResolvedValue(mqttClient as never);
  });

  it('reports every configured dependency as healthy when its probe succeeds', async () => {
    const report = await service.check();
    expect(report.status).toBe('degraded');
    expect(report.services).toEqual({
      api: { status: 'healthy', message: 'Responding normally' },
      postgresql: { status: 'healthy', message: 'Database connection successful' },
      redis: { status: 'healthy', provider: 'redis', message: 'Redis PING successful' },
      mqtt: { status: 'healthy', provider: 'emqx', message: 'MQTT CONNECT successful' },
      objectStorage: { status: 'healthy', provider: 'minio', bucket: 'robot-raw-files', message: 'Bucket reachable' },
      messageQueue: { status: 'healthy', provider: 'postgresql', message: 'PostgreSQL job queue reachable' },
      dvcRemote: { status: 'healthy', provider: 's3-compatible', bucket: 'robot-dvc-store', message: 'DVC remote reachable' },
      worker: expect.objectContaining({ status: 'healthy' }),
      certificate: { status: 'not_checked', message: 'Production certificate policy is not active in this environment' },
      backup: { status: 'not_checked', provider: 'restic', message: 'Backup evidence has not been reported' },
      restoreDrill: { status: 'not_checked', provider: 'restore-drill', message: 'No evidence has been reported' },
      retention: { status: 'not_checked', message: 'Retention execution is disabled' },
    });
    expect(redisClient.quit).toHaveBeenCalled();
    expect(mqttClient.endAsync).toHaveBeenCalledWith(true);
  });

  it('reports Redis and MQTT failures without exposing connection secrets', async () => {
    redisClient.connect.mockRejectedValue(new Error('redis://user:redis-secret@localhost'));
    jest.mocked(connectAsync).mockRejectedValue(new Error('tcp://user:mqtt-secret@localhost'));
    const report = await service.check();
    expect(report.status).toBe('unhealthy');
    expect(report.services.redis.status).toBe('unhealthy');
    expect(report.services.mqtt.status).toBe('unhealthy');
    expect(JSON.stringify(report)).not.toMatch(/redis-secret|mqtt-secret|secret@/);
  });

  it('times out an MQTT probe without reconnecting', async () => {
    jest.useFakeTimers();
    jest.mocked(connectAsync).mockReturnValue(new Promise(() => undefined));
    try {
      const pending = service.check();
      await jest.advanceTimersByTimeAsync(3_001);
      const report = await pending;
      expect(report.services.mqtt.status).toBe('unhealthy');
      expect(connectAsync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reconnectPeriod: 0, connectTimeout: 3_000 }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports an unavailable PostgreSQL job queue independently from the worker', async () => {
    prisma.job.count.mockRejectedValue(new Error('relation unavailable'));
    const report = await service.check();
    expect(report.services.messageQueue).toEqual({
      status: 'unhealthy', provider: 'postgresql', message: 'PostgreSQL job queue failed or timed out',
    });
    expect(report.services.worker.status).toBe('healthy');
  });

  it('reports a missing worker heartbeat as not_checked and degrades the aggregate', async () => {
    prisma.workerHeartbeat.findFirst.mockResolvedValue(null);
    const report = await service.check();
    expect(report.status).toBe('degraded');
    expect(report.services.worker).toEqual({ status: 'not_checked', message: 'No worker heartbeat has been registered' });
  });

  it('reports an unhealthy dependency without exposing the underlying error', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('postgresql://user:secret@localhost/private'));
    const report = await service.check();
    expect(report.status).toBe('unhealthy');
    expect(report.services.postgresql).toEqual({ status: 'unhealthy', message: 'Database connection failed or timed out' });
    expect(JSON.stringify(report)).not.toContain('secret');
  });

  it('reports an unconfigured DVC remote as not_checked and degrades the aggregate', async () => {
    dvc.checkRemoteHealth.mockResolvedValue({ configured: false });
    const report = await service.check();
    expect(report.status).toBe('degraded');
    expect(report.services.dvcRemote).toEqual({ status: 'not_checked', message: 'DVC remote is not configured' });
  });

  it('reports unreachable object and DVC storage without leaking errors', async () => {
    storage.checkHealth.mockResolvedValue({ provider: 'minio', bucket: 'robot-raw-files', reachable: false });
    dvc.checkRemoteHealth.mockResolvedValue({ configured: true, provider: 's3-compatible', bucket: 'robot-dvc-store', reachable: false });
    const report = await service.check();
    expect(report.status).toBe('unhealthy');
    expect(report.services.objectStorage.status).toBe('unhealthy');
    expect(report.services.dvcRemote.status).toBe('unhealthy');
  });
});
