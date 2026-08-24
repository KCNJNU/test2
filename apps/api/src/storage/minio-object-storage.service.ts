import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { ListObjectsResult, ObjectStorage, ObjectStorageHealth, PutObjectInput, StoredObject } from './object-storage';

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
  async getPresignedDownloadUrl(objectKey: string, expiresSeconds = 60 * 15): Promise<string> { return this.client.presignedGetObject(this.bucket, objectKey, expiresSeconds); }
  async checkHealth(): Promise<ObjectStorageHealth> {
    try { return { provider: 'minio', bucket: this.bucket, reachable: await this.client.bucketExists(this.bucket) }; }
    catch { return { provider: 'minio', bucket: this.bucket, reachable: false }; }
  }
  async statObject(objectKey: string): Promise<StoredObject> {
    const stat = await this.client.statObject(this.bucket, objectKey);
    return { objectKey, size: stat.size, etag: stat.etag, lastModified: stat.lastModified };
  }
  async listObjects(input: { prefix?: string; cursor?: string; limit: number }): Promise<ListObjectsResult> {
    const stream = this.client.listObjectsV2(this.bucket, input.prefix ?? '', true, input.cursor ?? '');
    const items: StoredObject[] = [];
    for await (const value of stream) {
      const item = value as { name?: string; size?: number; etag?: string; lastModified?: Date; prefix?: string };
      if (!item.name) continue;
      items.push({ objectKey: item.name, size: item.size ?? 0, etag: item.etag, lastModified: item.lastModified });
      if (items.length > input.limit) { stream.destroy(); break; }
    }
    const hasMore = items.length > input.limit;
    if (hasMore) items.pop();
    return { items, nextCursor: hasMore ? items.at(-1)?.objectKey : undefined };
  }
  async composeObject(objectKey: string, sourceObjectKeys: string[], contentType: string): Promise<void> {
    if (!sourceObjectKeys.length) throw new Error('At least one source object is required');
    const sources = sourceObjectKeys.map((source) => new Minio.CopySourceOptions({ Bucket: this.bucket, Object: source }));
    const destination = new Minio.CopyDestinationOptions({ Bucket: this.bucket, Object: objectKey, Headers: { 'Content-Type': contentType } });
    await this.client.composeObject(destination, sources);
  }
  async deleteObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length) await this.client.removeObjects(this.bucket, objectKeys);
  }
}
