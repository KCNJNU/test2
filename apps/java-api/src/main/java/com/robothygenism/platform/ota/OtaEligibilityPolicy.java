package com.robothygenism.platform.ota;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class OtaEligibilityPolicy {
  public List<String> violations(RobotCandidate robot, int minimumBattery, List<String> compatibleHardware, String targetVersion) {
    var reasons = new ArrayList<String>();
    if (!"ONLINE".equals(robot.onlineStatus())) reasons.add("ROBOT_OFFLINE");
    if (!List.of("IDLE", "READY", "CHARGING").contains(robot.operationalState())) reasons.add("ROBOT_BUSY");
    if (robot.dangerousMaintenance()) reasons.add("DANGEROUS_MAINTENANCE_ACTIVE");
    if (robot.batteryPercent() == null || robot.batteryPercent() < minimumBattery) reasons.add("BATTERY_INSUFFICIENT");
    if (!compatibleHardware.isEmpty() && (robot.hardwareModel() == null || !compatibleHardware.contains(robot.hardwareModel()))) reasons.add("TARGET_INCOMPATIBLE");
    if (targetVersion != null && targetVersion.equals(robot.currentVersion())) reasons.add("ALREADY_ON_TARGET");
    return List.copyOf(reasons);
  }

  public record RobotCandidate(
      java.util.UUID id,
      String onlineStatus,
      String operationalState,
      Integer batteryPercent,
      String hardwareModel,
      String currentVersion,
      boolean dangerousMaintenance) {}
}
