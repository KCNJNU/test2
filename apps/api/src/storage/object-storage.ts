export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectInput {
  objectKey: string;
  content: Buffer;
  contentType: string;
}

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(objectKey: string): Promise<NodeJS.ReadableStream>;
  deleteObject(objectKey: string): Promise<void>;
  exists(objectKey: string): Promise<boolean>;
  getPresignedDownloadUrl(objectKey: string): Promise<string>;
}
