package com.robothygenism.platform.task;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.robothygenism.platform.common.ApiException;
import org.junit.jupiter.api.Test;

class TaskStateServiceTest {
  private final TaskStateService states=new TaskStateService();
  @Test void pausedCanResumeButBlockedCannotUseOrdinaryResume(){assertDoesNotThrow(()->states.requireCommand("PAUSED","resume"));assertThrows(ApiException.class,()->states.requireCommand("BLOCKED","resume"));}
  @Test void commandAcceptanceDoesNotPermitInvalidActions(){assertDoesNotThrow(()->states.requireCommand("RUNNING","pause"));assertThrows(ApiException.class,()->states.requireCommand("DRAFT","pause"));assertThrows(ApiException.class,()->states.requireCommand("COMPLETED","cancel"));}
  @Test void pausedAndBlockedRemainDifferentDomainStates(){assertDoesNotThrow(()->states.require("RUNNING","PAUSED"));assertDoesNotThrow(()->states.require("RUNNING","BLOCKED"));assertThrows(ApiException.class,()->states.require("BLOCKED","PAUSED"));}
}
