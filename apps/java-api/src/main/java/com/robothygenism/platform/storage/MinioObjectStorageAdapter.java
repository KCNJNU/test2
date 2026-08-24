package com.robothygenism.platform.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import java.io.InputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Infrastructure adapter. Business services depend only on ObjectStoragePort. */
@Service
public class MinioObjectStorageAdapter implements ObjectStoragePort {
  private final MinioClient client;
  private final String bucket;

  public MinioObjectStorageAdapter(
      @Value("${OBJECT_STORAGE_ENDPOINT}") String endpoint,
      @Value("${OBJECT_STORAGE_PORT}") int port,
      @Value("${OBJECT_STORAGE_USE_SSL}") boolean useSsl,
      @Value("${OBJECT_STORAGE_BUCKET}") String bucket,
      @Value("${OBJECT_STORAGE_ACCESS_KEY}") String accessKey,
      @Value("${OBJECT_STORAGE_SECRET_KEY}") String secretKey) {
    this.bucket = bucket;
    this.client = MinioClient.builder()
        .endpoint((useSsl ? "https" : "http") + "://" + endpoint + ":" + port)
        .credentials(accessKey, secretKey)
        .build();
  }

  @Override public void put(String objectKey, InputStream content, long size, String mimeType) {
    execute(() -> {
      if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
        client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
      }
      client.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey).stream(content, size, -1).contentType(mimeType).build());
      return null;
    });
  }

  @Override public InputStream get(String objectKey) {
    return execute(() -> client.getObject(GetObjectArgs.builder().bucket(bucket).object(objectKey).build()));
  }

  @Override public void delete(String objectKey) {
    execute(() -> { client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build()); return null; });
  }

  @Override public boolean exists(String objectKey) {
    try { client.statObject(StatObjectArgs.builder().bucket(bucket).object(objectKey).build()); return true; }
    catch (ErrorResponseException error) { return false; }
    catch (Exception error) { throw new IllegalStateException("Object storage is unavailable", error); }
  }

  @Override public long size(String objectKey) {
    return execute(() -> client.statObject(StatObjectArgs.builder().bucket(bucket).object(objectKey).build()).size());
  }

  @Override public String presignedGet(String objectKey, int expiresSeconds) {
    return execute(() -> client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder().method(Method.GET).bucket(bucket).object(objectKey).expiry(expiresSeconds).build()));
  }

  private <T> T execute(Checked<T> action) {
    try { return action.run(); }
    catch (Exception error) { throw new IllegalStateException("Object storage operation failed", error); }
  }

  @FunctionalInterface private interface Checked<T> { T run() throws Exception; }
}
