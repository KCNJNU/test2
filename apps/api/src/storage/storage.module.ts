import { Module } from '@nestjs/common';
import { MinioObjectStorageService } from './minio-object-storage.service';
import { OBJECT_STORAGE } from './object-storage';

@Module({ providers: [MinioObjectStorageService, { provide: OBJECT_STORAGE, useExisting: MinioObjectStorageService }], exports: [OBJECT_STORAGE] })
export class StorageModule {}
