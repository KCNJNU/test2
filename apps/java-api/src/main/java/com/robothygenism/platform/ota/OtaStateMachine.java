package com.robothygenism.platform.ota;

import com.robothygenism.platform.common.ApiException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class OtaStateMachine {
  private static final Map<String, Set<String>> ALLOWED = Map.of(
      "PENDING", Set.of("DOWNLOADING", "FAILED"),
      "DOWNLOADING", Set.of("VERIFYING", "FAILED"),
      "VERIFYING", Set.of("INSTALLING", "FAILED"),
      "INSTALLING", Set.of("REBOOTING", "FAILED", "ROLLED_BACK"),
      "REBOOTING", Set.of("VALIDATING", "FAILED", "ROLLED_BACK"),
      "VALIDATING", Set.of("SUCCEEDED", "FAILED", "ROLLED_BACK"),
      "FAILED", Set.of("ROLLED_BACK"));

  public boolean canMove(String from, String to) {
    return from.equals(to) || ALLOWED.getOrDefault(from, Set.of()).contains(to);
  }

  public void require(String from, String to) {
    if (!canMove(from, to)) throw new ApiException(HttpStatus.CONFLICT, "OTA_STATE_TRANSITION_INVALID", "OTA state transition is not allowed");
  }

  public boolean terminal(String status) { return Set.of("SUCCEEDED", "FAILED", "ROLLED_BACK").contains(status); }
}
