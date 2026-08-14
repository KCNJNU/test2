import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { ObjectStorage, PutObjectInput } from './object-storage';

/** Development adapter. Domain services must depend on ObjectStorage, not this class. */
@Injectable()
export class MinioObjectStorageService implements ObjectStorage {
  private readonly bucket: string;
  private readonly client: Minio.Client;
  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('OBJECT_STORAGE_BUCKET');
    this.client = new Minio.Client({
      endPoint: config.getOrThrow<string>('OBJECT_STORAGE_ENDPOINT'),
      port: Number(config.getOrThrow<string>('OBJECT_STORAGE_PORT')),
      useSSL: config.get<string>('OBJECT_STORAGE_USE_SSL') === 'true',
      accessKey: config.getOrThrow<string>('OBJECT_STORAGE_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('OBJECT_STORAGE_SECRET_KEY'),
    });
  }
  private async ensureBucket(): Promise<void> {
    if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
  }
  async putObject({ objectKey, content, contentType }: PutObjectInput): Promise<void> {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, objectKey, content, content.length, { 'Content-Type': contentType });
  }
  async getObject(objectKey: string): Promise<NodeJS.ReadableStream> { return this.client.getObject(this.bucket, objectKey); }
  async deleteObject(objectKey: string): Promise<void> { await this.client.removeObject(this.bucket, objectKey); }
  async exists(objectKey: string): Promise<boolean> { try { await this.client.statObject(this.bucket, objectKey); return true; } catch { return false; } }
  async getPresignedDownloadUrl(objectKey: string): Promise<string> { return this.client.presignedGetObject(this.bucket, objectKey, 60 * 15); }
}
