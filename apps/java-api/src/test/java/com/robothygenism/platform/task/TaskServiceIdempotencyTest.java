package com.robothygenism.platform.task;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.robothygenism.platform.common.ApiException;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TaskServiceIdempotencyTest {
  @Test void acceptsAnExactRetryAfterTheFirstCommandChangedRuntimeState(){
    UUID taskId=UUID.randomUUID();
    assertDoesNotThrow(()->TaskService.requireMatchingIdempotentCommand(Map.of("taskId",taskId,"type","MISSION_START"),taskId,"MISSION_START"));
  }

  @Test void rejectsReusingAKeyForAnotherTaskOrAction(){
    UUID taskId=UUID.randomUUID();
    assertThrows(ApiException.class,()->TaskService.requireMatchingIdempotentCommand(Map.of("taskId",UUID.randomUUID(),"type","MISSION_START"),taskId,"MISSION_START"));
    assertThrows(ApiException.class,()->TaskService.requireMatchingIdempotentCommand(Map.of("taskId",taskId,"type","MISSION_PAUSE"),taskId,"MISSION_START"));
  }
}
