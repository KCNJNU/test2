import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connectAsync, MqttClient } from 'mqtt';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from 'redis';
import { DvcService } from '../dvc/dvc.service';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'not_checked';
export type ServiceHealth = { status: HealthStatus; message: string; provider?: string; bucket?: string };
export type HealthReport = {
  status: HealthStatus;
  timestamp: string;
  services: {
    api: ServiceHealth;
    postgresql: ServiceHealth;
    redis: ServiceHealth;
    mqtt: ServiceHealth;
    objectStorage: ServiceHealth;
    messageQueue: ServiceHealth;
    dvcRemote: ServiceHealth;
    worker: ServiceHealth;
    certificate: ServiceHealth;
    backup: ServiceHealth;
    restoreDrill: ServiceHealth;
    retention: ServiceHealth;
  };
};

const CHECK_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly dvc: DvcService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgresql, redis, mqtt, objectStorage, messageQueue, dvcRemote, worker, certificate, backup, restoreDrill, retention] = await Promise.all([
      this.checkPostgresql(),
      this.checkRedis(),
      this.checkMqtt(),
      this.checkObjectStorage(),
      this.checkMessageQueue(),
      this.checkDvcRemote(),
      this.checkWorker(),
      this.checkCertificates(),
      this.checkBackup(),
      this.checkRestoreDrill(),
      this.checkRetention(),
    ]);
    const services = {
      api: { status: 'healthy' as const, message: 'Responding normally' },
      postgresql,
      redis,
      mqtt,
      objectStorage,
      messageQueue,
      dvcRemote,
      worker,
      certificate,
      backup,
      restoreDrill,
      retention,
    };
    const statuses = Object.values(services).map((service) => service.status);
    const status: HealthStatus = statuses.includes('unhealthy')
      ? 'unhealthy'
      : statuses.includes('degraded') || statuses.includes('not_checked')
        ? 'degraded'
        : 'healthy';
    return { status, timestamp: new Date().toISOString(), services };
  }

  private async checkRedis(): Promise<ServiceHealth> {
    let client: ReturnType<typeof createClient> | undefined;
    try {
      const host = this.config.getOrThrow<string>('REDIS_HOST');
      const port = this.config.getOrThrow<string>('REDIS_PORT');
      client = createClient({
        socket: { host, port: Number(port), connectTimeout: CHECK_TIMEOUT_MS, reconnectStrategy: false },
      });
      client.on('error', () => undefined);
      await this.withTimeout(client.connect());
      await this.withTimeout(client.ping());
      return { status: 'healthy', provider: 'redis', message: 'Redis PING successful' };
    } catch {
      return { status: 'unhealthy', provider: 'redis', message: 'Redis connection failed or timed out' };
    } finally {
      if (client?.isOpen) await client.quit().catch(() => client?.destroy());
      else client?.destroy();
    }
  }

  private async checkMqtt(): Promise<ServiceHealth> {
    let client: MqttClient | undefined;
    try {
      const brokerUri = this.config.getOrThrow<string>('MQTT_BROKER_URI');
      client = await this.withTimeout(connectAsync(brokerUri, {
        clean: true,
        clientId: this.config.get<string>('DEPLOYMENT_ENVIRONMENT')?.toUpperCase() === 'PRODUCTION' ? 'platform-health' : `platform-health-${randomUUID()}`,
        connectTimeout: CHECK_TIMEOUT_MS,
        reconnectPeriod: 0,
        ...this.mqttTlsOptions(),
      }));
      return { status: 'healthy', provider: 'emqx', message: 'MQTT CONNECT successful' };
    } catch {
      return { status: 'unhealthy', provider: 'emqx', message: 'MQTT connection failed or timed out' };
    } finally {
      if (client) await client.endAsync(true).catch(() => undefined);
    }
  }

  private async checkMessageQueue(): Promise<ServiceHealth> {
    try {
      await this.withTimeout(this.prisma.job.count());
      return { status: 'healthy', provider: 'postgresql', message: 'PostgreSQL job queue reachable' };
    } catch {
      return { status: 'unhealthy', provider: 'postgresql', message: 'PostgreSQL job queue failed or timed out' };
    }
  }

  private async checkWorker(): Promise<ServiceHealth> {
    try { const value = await this.prisma.workerHeartbeat.findFirst({ orderBy: { heartbeatAt: 'desc' } }); if (!value) return { status: 'not_checked', message: 'No worker heartbeat has been registered' }; const delay = Date.now() - value.heartbeatAt.getTime(); return delay < 60_000 ? { status: 'healthy', message: `Worker heartbeat received ${Math.round(delay / 1000)}s ago` } : { status: 'unhealthy', message: `Worker heartbeat is stale (${Math.round(delay / 1000)}s)` }; }
    catch { return { status: 'not_checked', message: 'Worker heartbeat could not be checked' }; }
  }

  private async checkCertificates(): Promise<ServiceHealth> {
    if (this.config.get<string>('DEPLOYMENT_ENVIRONMENT')?.toUpperCase() !== 'PRODUCTION') return { status: 'not_checked', message: 'Production certificate policy is not active in this environment' };
    try {
      const now = new Date(); const warning = new Date(Date.now() + 30 * 86_400_000);
      const [active, expiring] = await Promise.all([
        this.prisma.deviceCertificate.count({ where: { status: 'ACTIVE', notAfter: { gt: now } } }),
        this.prisma.deviceCertificate.count({ where: { status: 'ACTIVE', notAfter: { gt: now, lt: warning } } }),
      ]);
      if (!active) return { status: 'unhealthy', provider: 'vault-pki', message: 'No active robot certificate is registered' };
      return expiring ? { status: 'degraded', provider: 'vault-pki', message: `${expiring} certificate(s) expire within 30 days` } : { status: 'healthy', provider: 'vault-pki', message: 'Active device certificates are within their renewal window' };
    } catch { return { status: 'unhealthy', provider: 'vault-pki', message: 'Certificate inventory could not be checked' }; }
  }

  private async checkBackup(): Promise<ServiceHealth> {
    const database = await this.latestEvidence('DATABASE_BACKUP', 3_600);
    const objects = await this.latestEvidence('OBJECT_BACKUP', 21_600);
    if (database.status === 'not_checked' || objects.status === 'not_checked') return { status: 'not_checked', provider: 'restic', message: 'Backup evidence has not been reported' };
    return database.status === 'healthy' && objects.status === 'healthy' ? { status: 'healthy', provider: 'restic', message: 'Database and object backups are within RPO' } : { status: 'unhealthy', provider: 'restic', message: 'Backup evidence is failed or outside RPO' };
  }

  private checkRestoreDrill() { return this.latestEvidence('RESTORE_DRILL', 35 * 86_400); }

  private async checkRetention(): Promise<ServiceHealth> {
    if (this.config.get<string>('RETENTION_EXECUTION_ENABLED') !== 'true') return { status: 'not_checked', message: 'Retention execution is disabled' };
    try {
      const last = await this.prisma.job.findFirst({ where: { type: 'RETENTION_CLEANUP' }, orderBy: { createdAt: 'desc' } });
      if (!last) return { status: 'not_checked', message: 'No retention job has run' };
      return last.status === 'FAILED' ? { status: 'unhealthy', message: 'The latest retention job failed' } : { status: 'healthy', message: `Latest retention job status: ${last.status}` };
    } catch { return { status: 'unhealthy', message: 'Retention status could not be checked' }; }
  }

  private async latestEvidence(type: 'DATABASE_BACKUP' | 'OBJECT_BACKUP' | 'RESTORE_DRILL', maxAgeSeconds: number): Promise<ServiceHealth> {
    try {
      const evidence = type === 'RESTORE_DRILL'
        ? await this.prisma.restoreDrill.findFirst({ orderBy: { completedAt: 'desc' } })
        : await this.prisma.backupEvidence.findFirst({ where: { type }, orderBy: { completedAt: 'desc' } });
      if (!evidence) return { status: 'not_checked', provider: type === 'RESTORE_DRILL' ? 'restore-drill' : 'restic', message: 'No evidence has been reported' };
      const fresh = Date.now() - evidence.completedAt.getTime() <= maxAgeSeconds * 1000;
      return evidence.status === 'SUCCEEDED' && fresh ? { status: 'healthy', provider: type === 'RESTORE_DRILL' ? 'restore-drill' : 'restic', message: 'Evidence is within the recovery objective' } : { status: 'unhealthy', provider: type === 'RESTORE_DRILL' ? 'restore-drill' : 'restic', message: 'Evidence is failed or stale' };
    } catch { return { status: 'not_checked', message: 'Resilience evidence could not be checked' }; }
  }

  private mqttTlsOptions() {
    if (this.config.get<string>('DEPLOYMENT_ENVIRONMENT')?.toUpperCase() !== 'PRODUCTION') return {};
    return {
      ca: readFileSync(this.config.getOrThrow<string>('MQTT_HEALTH_TLS_CA_FILE')),
      cert: readFileSync(this.config.getOrThrow<string>('MQTT_HEALTH_TLS_CERT_FILE')),
      key: readFileSync(this.config.getOrThrow<string>('MQTT_HEALTH_TLS_KEY_FILE')),
      servername: this.config.getOrThrow<string>('MQTT_TLS_SERVER_NAME'),
      rejectUnauthorized: true,
    };
  }

  private async checkPostgresql(): Promise<ServiceHealth> {
    try {
      await this.withTimeout(this.prisma.$queryRaw`SELECT 1`);
      return { status: 'healthy', message: 'Database connection successful' };
    } catch {
      return { status: 'unhealthy', message: 'Database connection failed or timed out' };
    }
  }

  private async checkObjectStorage(): Promise<ServiceHealth> {
    try {
      const result = await this.withTimeout(this.storage.checkHealth());
      return result.reachable
        ? { status: 'healthy', provider: result.provider, bucket: result.bucket, message: 'Bucket reachable' }
        : { status: 'unhealthy', provider: result.provider, bucket: result.bucket, message: 'Configured bucket is not reachable' };
    } catch {
      return { status: 'unhealthy', message: 'Object storage connection failed or timed out' };
    }
  }

  private async checkDvcRemote(): Promise<ServiceHealth> {
    try {
      const result = await this.withTimeout(this.dvc.checkRemoteHealth());
      if (!result.configured) return { status: 'not_checked', message: 'DVC remote is not configured' };
      return result.reachable
        ? { status: 'healthy', provider: result.provider, bucket: result.bucket, message: 'DVC remote reachable' }
        : { status: 'unhealthy', provider: result.provider, bucket: result.bucket, message: 'Configured DVC remote bucket is not reachable' };
    } catch {
      return { status: 'unhealthy', message: 'DVC remote connection failed or timed out' };
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Health check timed out')), CHECK_TIMEOUT_MS); });
    try { return await Promise.race([operation, deadline]); }
    finally { if (timeout) clearTimeout(timeout); }
  }
}
