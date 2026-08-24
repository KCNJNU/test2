import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { JobExecutorService } from './job-executor.service';

@Injectable()
export class WorkerRunnerService {
  private readonly logger = new Logger(WorkerRunnerService.name);
  private readonly workerId = `${process.env.COMPUTERNAME ?? 'worker'}-${process.pid}-${randomUUID().slice(0, 8)}`;
  private stopping = false;
  constructor(private readonly jobs: JobsService, private readonly executor: JobExecutorService, private readonly prisma: PrismaService, private readonly settings: SettingsService, private readonly config: ConfigService) {}

  async start() {
    const configured = Number(this.config.get<string>('WORKER_CONCURRENCY') ?? await this.settings.get('jobs.workerConcurrency'));
    const concurrency = Math.max(1, Math.min(8, Number.isFinite(configured) ? configured : 2));
    const startedAt = new Date();
    await this.prisma.workerHeartbeat.upsert({ where: { workerId: this.workerId }, update: { version: '2.1.0', concurrency, startedAt, heartbeatAt: new Date() }, create: { workerId: this.workerId, version: '2.1.0', concurrency, startedAt, heartbeatAt: new Date() } });
    this.logger.log(`Worker ${this.workerId} started with concurrency ${concurrency}`);
    const heartbeat = setInterval(() => void this.prisma.workerHeartbeat.update({ where: { workerId: this.workerId }, data: { heartbeatAt: new Date() } }).catch(() => undefined), 10_000);
    const active = new Set<Promise<void>>();
    const stop = () => { this.stopping = true; };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    try {
      while (!this.stopping) {
        while (active.size < concurrency && !this.stopping) {
          const job = await this.jobs.claim(this.workerId);
          if (!job) break;
          const task = this.executor.execute(job, this.workerId).finally(() => active.delete(task)); active.add(task);
        }
        if (active.size) await Promise.race([...active, delay(1_000)]); else await delay(1_000);
      }
      await Promise.allSettled(active);
    } finally { clearInterval(heartbeat); await this.prisma.workerHeartbeat.deleteMany({ where: { workerId: this.workerId } }); }
  }
}
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
