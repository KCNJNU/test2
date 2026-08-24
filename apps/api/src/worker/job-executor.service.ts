import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JobType } from '@prisma/client';
import { DatasetPublishService } from '../datasets/dataset-publish.service';
import { JobsService } from '../jobs/jobs.service';
import { StorageOperationsService } from '../storage/storage-operations.service';
import { UploadsService } from '../uploads/uploads.service';
import { RetentionCleanupService } from './retention-cleanup.service';

type ClaimedJob = Awaited<ReturnType<JobsService['get']>>;

@Injectable()
export class JobExecutorService {
  constructor(private readonly jobs: JobsService, private readonly publisher: DatasetPublishService, private readonly storage: StorageOperationsService, private readonly uploads: UploadsService, private readonly retention: RetentionCleanupService) {}

  async execute(job: ClaimedJob, workerId: string) {
    let activeStep: string | undefined;
    const runStep = async <T>(name: string, action: () => Promise<T>) => {
      activeStep = name;
      if (await this.jobs.isCancelRequested(job.id)) throw new JobCancelledError();
      const shouldRun = await this.jobs.beginStep(job.id, name);
      if (!shouldRun) return action();
      const result = await action();
      await this.jobs.completeStep(job.id, name);
      activeStep = undefined;
      return result;
    };
    const leaseRequired = job.type === JobType.DATASET_PUBLISH || job.type === JobType.RECOVERY_VERIFY;
    if (leaseRequired && !await this.jobs.acquireLease('git-dvc-publication', workerId)) throw new ServiceUnavailableException('Git/DVC publication lease is currently held by another worker');
    const leaseTimer = leaseRequired ? setInterval(() => void this.jobs.heartbeatLease('git-dvc-publication', workerId), 10_000) : undefined;
    try {
      let result: unknown;
      const payload = job.payload as Record<string, unknown>;
      if (job.type === JobType.DATASET_PUBLISH) result = await this.publisher.publish(this.requireString(payload.versionId), runStep);
      else if (job.type === JobType.RECOVERY_VERIFY) result = await this.publisher.recoveryVerify(this.requireString(payload.versionId), runStep);
      else if (job.type === JobType.STORAGE_SCAN) {
        await runStep('Load Database Index', async () => undefined); await runStep('List ObjectStorage', async () => undefined);
        result = await runStep('Compare Objects', () => this.storage.executeScan(this.requireString(payload.runId)));
        await runStep('Persist Issues', async () => undefined);
      } else if (job.type === JobType.STORAGE_ORPHAN_DELETE) {
        const issueIds = this.requireStrings(payload.issueIds); await runStep('Validate Issues', async () => undefined);
        result = await runStep('Delete Objects', () => this.storage.executeOrphanDelete(issueIds)); await runStep('Resolve Issues', async () => undefined);
      } else if (job.type === JobType.UPLOAD_FINALIZE) {
        await runStep('Validate Parts', async () => undefined); await runStep('Compose Object', async () => undefined);
        result = await runStep('Verify Format and Checksum', () => this.uploads.finalize(this.requireString(payload.uploadSessionId)));
        await runStep('Create RobotFile', async () => undefined); await runStep('Cleanup Parts', async () => undefined);
      } else if (job.type === JobType.RETENTION_CLEANUP) {
        result = await this.retention.execute(job.requestedById);
      }
      if (await this.jobs.isCancelRequested(job.id)) await this.jobs.markCancelled(job.id); else await this.jobs.finish(job.id, this.jsonResult(result));
    } catch (error) {
      if (error instanceof JobCancelledError) await this.jobs.markCancelled(job.id);
      else await this.jobs.fail(job.id, error, activeStep, this.isInfrastructure(error));
    } finally {
      if (leaseTimer) clearInterval(leaseTimer);
      if (leaseRequired) await this.jobs.releaseLease('git-dvc-publication', workerId);
    }
  }

  private requireString(value: unknown) { if (typeof value !== 'string') throw new ConflictException('Job payload is invalid'); return value; }
  private requireStrings(value: unknown) { if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new ConflictException('Job payload is invalid'); return value as string[]; }
  private isInfrastructure(error: unknown) { return error instanceof ServiceUnavailableException || (error instanceof Error && /ECONN|timed out|unreachable|socket|storage/i.test(error.message)); }
  private jsonResult(value: unknown) { return JSON.parse(JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item)) as object; }
}

class JobCancelledError extends Error {}
