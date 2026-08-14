/** Minimal upload shape provided by Nest's multipart interceptor. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
