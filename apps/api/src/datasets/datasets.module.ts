import { Module } from '@nestjs/common';
import { DatasetsController } from './datasets.controller';
import { DatasetPublishService } from './dataset-publish.service';
import { DatasetsService } from './datasets.service';
import { DvcModule } from '../dvc/dvc.module';
import { StorageModule } from '../storage/storage.module';

@Module({ imports: [DvcModule, StorageModule], controllers: [DatasetsController], providers: [DatasetsService, DatasetPublishService], exports: [DatasetsService, DatasetPublishService] })
export class DatasetsModule {}
