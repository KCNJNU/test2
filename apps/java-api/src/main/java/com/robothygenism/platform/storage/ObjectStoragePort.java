package com.robothygenism.platform.storage;
import java.io.InputStream;
public interface ObjectStoragePort {
  void put(String objectKey, InputStream content, long size, String mimeType);
  InputStream get(String objectKey);
  void delete(String objectKey);
  boolean exists(String objectKey);
  long size(String objectKey);
  String presignedGet(String objectKey, int expiresSeconds);
}
