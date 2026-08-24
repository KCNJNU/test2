import { Module } from '@nestjs/common';
import { DatasetsModule } from '../datasets/datasets.module';
import { StorageModule } from '../storage/storage.module';
import { UploadsModule } from '../uploads/uploads.module';
import { JobExecutorService } from './job-executor.service';
import { WorkerRunnerService } from './worker-runner.service';
import { RetentionCleanupService } from './retention-cleanup.service';
@Module({ imports: [DatasetsModule, StorageModule, UploadsModule], providers: [JobExecutorService, WorkerRunnerService, RetentionCleanupService], exports: [WorkerRunnerService] }) export class WorkerModule {}
