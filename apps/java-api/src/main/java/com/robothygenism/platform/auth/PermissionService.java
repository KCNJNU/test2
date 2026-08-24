package com.robothygenism.platform.auth;

import com.robothygenism.platform.common.ApiException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class PermissionService {
  private static final Set<String> ALL = Set.of("TENANT_MANAGE", "PROJECT_MANAGE", "ROBOT_MANAGE", "TASK_CONTROL", "MAP_MANAGE", "MAP_PUBLISH", "FAULT_ACKNOWLEDGE", "MAINTENANCE_MANAGE", "OTA_MANAGE", "CONFIG_SAFETY_MANAGE", "AUDIT_READ", "USER_MANAGE", "DATA_MANAGE", "DEVICE_IDENTITY_MANAGE", "RESILIENCE_MANAGE");
  private static final Map<String, Set<String>> MATRIX = Map.of(
      "SUPER_ADMIN", ALL,
      "TENANT_ADMIN", Set.of("PROJECT_MANAGE", "ROBOT_MANAGE", "TASK_CONTROL", "MAP_MANAGE", "MAP_PUBLISH", "FAULT_ACKNOWLEDGE", "MAINTENANCE_MANAGE", "OTA_MANAGE", "AUDIT_READ", "USER_MANAGE", "DATA_MANAGE"),
      "PROJECT_ADMIN", Set.of("ROBOT_MANAGE", "TASK_CONTROL", "MAP_MANAGE", "MAP_PUBLISH", "FAULT_ACKNOWLEDGE", "MAINTENANCE_MANAGE", "OTA_MANAGE", "AUDIT_READ", "DATA_MANAGE"),
      "OPERATOR", Set.of("TASK_CONTROL", "FAULT_ACKNOWLEDGE"),
      "MAINTENANCE_ENGINEER", Set.of("FAULT_ACKNOWLEDGE", "MAINTENANCE_MANAGE", "OTA_MANAGE"),
      "VIEWER", Set.of());

  public boolean has(PlatformPrincipal principal, String permission) { return MATRIX.getOrDefault(principal.role(), Set.of()).contains(permission); }
  public void require(PlatformPrincipal principal, String permission) {
    if (!has(principal, permission)) throw new ApiException(HttpStatus.FORBIDDEN, "PERMISSION_DENIED", "Permission denied", Map.of("permission", permission));
  }
}
