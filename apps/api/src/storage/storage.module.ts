import { Module } from '@nestjs/common';
import { MinioObjectStorageService } from './minio-object-storage.service';
import { OBJECT_STORAGE } from './object-storage';
import { StorageController } from './storage.controller';
import { StorageOperationsService } from './storage-operations.service';

@Module({ controllers: [StorageController], providers: [MinioObjectStorageService, { provide: OBJECT_STORAGE, useExisting: MinioObjectStorageService }, StorageOperationsService], exports: [OBJECT_STORAGE, StorageOperationsService] })
export class StorageModule {}
