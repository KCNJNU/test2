package com.robothygenism.platform.device;
import java.time.OffsetDateTime;import java.util.Map;import java.util.UUID;
public interface TelemetryStore { void append(UUID robotId,String messageId,long sequence,OffsetDateTime deviceTimestamp,OffsetDateTime receivedAt,Map<String,Object> payload); }
