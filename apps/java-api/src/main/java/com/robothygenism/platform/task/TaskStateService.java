package com.robothygenism.platform.task;

import com.robothygenism.platform.common.ApiException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class TaskStateService {
  private static final Map<String,Set<String>> ALLOWED=Map.ofEntries(
      Map.entry("DRAFT",Set.of("SCHEDULED","QUEUED","DISPATCHING","CANCELED")),Map.entry("SCHEDULED",Set.of("QUEUED","DISPATCHING","CANCELED")),
      Map.entry("QUEUED",Set.of("DISPATCHING","CANCELED")),Map.entry("DISPATCHING",Set.of("ACCEPTED","FAILED","CANCELED")),
      Map.entry("ACCEPTED",Set.of("RUNNING","FAILED","CANCELED")),Map.entry("RUNNING",Set.of("PAUSED","BLOCKED","COMPLETED","FAILED","CANCELED")),
      Map.entry("PAUSED",Set.of("RUNNING","BLOCKED","FAILED","CANCELED")),Map.entry("BLOCKED",Set.of("RUNNING","FAILED","CANCELED")));
  public void require(String from,String to){if(!ALLOWED.getOrDefault(from,Set.of()).contains(to))throw new ApiException(HttpStatus.CONFLICT,"INVALID_TASK_TRANSITION","Task transition is not allowed",Map.of("from",from,"to",to));}
  public void requireCommand(String state,String action){boolean allowed=switch(action){case "start"->Set.of("DRAFT","SCHEDULED","QUEUED").contains(state);case "pause"->state.equals("RUNNING");case "resume"->state.equals("PAUSED");case "cancel"->!Set.of("COMPLETED","FAILED","CANCELED").contains(state);default->false;};if(!allowed)throw new ApiException(HttpStatus.CONFLICT,"COMMAND_NOT_ALLOWED","Command is not allowed for current task state",Map.of("state",state,"action",action));}
}
