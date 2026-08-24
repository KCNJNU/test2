export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectInput {
  objectKey: string;
  content: Buffer;
  contentType: string;
}

export interface ObjectStorageHealth {
  provider: string;
  bucket: string;
  reachable: boolean;
}

export interface StoredObject {
  objectKey: string;
  size: number;
  etag?: string;
  lastModified?: Date;
}

export interface ListObjectsResult {
  items: StoredObject[];
  nextCursor?: string;
}

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(objectKey: string): Promise<NodeJS.ReadableStream>;
  deleteObject(objectKey: string): Promise<void>;
  exists(objectKey: string): Promise<boolean>;
  getPresignedDownloadUrl(objectKey: string, expiresSeconds?: number): Promise<string>;
  checkHealth(): Promise<ObjectStorageHealth>;
  statObject(objectKey: string): Promise<StoredObject>;
  listObjects(input: { prefix?: string; cursor?: string; limit: number }): Promise<ListObjectsResult>;
  composeObject(objectKey: string, sourceObjectKeys: string[], contentType: string): Promise<void>;
  deleteObjects(objectKeys: string[]): Promise<void>;
}
