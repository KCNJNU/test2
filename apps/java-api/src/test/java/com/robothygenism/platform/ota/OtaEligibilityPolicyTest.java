package com.robothygenism.platform.ota;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OtaEligibilityPolicyTest {
  private final OtaEligibilityPolicy policy = new OtaEligibilityPolicy();

  @Test void permitsAnOnlineReadyCompatibleRobotWithSufficientBattery() {
    var robot = new OtaEligibilityPolicy.RobotCandidate(UUID.randomUUID(), "ONLINE", "READY", 80, "CR-X1", "v1.0.0", false);
    assertThat(policy.violations(robot, 30, List.of("CR-X1"), "v1.1.0")).isEmpty();
  }

  @Test void failsClosedForBusyUnknownBatteryMaintenanceOrHardwareMismatch() {
    var robot = new OtaEligibilityPolicy.RobotCandidate(UUID.randomUUID(), "OFFLINE", "RUNNING", null, "CR-X0", "v1.1.0", true);
    assertThat(policy.violations(robot, 30, List.of("CR-X1"), "v1.1.0"))
        .containsExactly("ROBOT_OFFLINE", "ROBOT_BUSY", "DANGEROUS_MAINTENANCE_ACTIVE", "BATTERY_INSUFFICIENT", "TARGET_INCOMPATIBLE", "ALREADY_ON_TARGET");
  }
}
