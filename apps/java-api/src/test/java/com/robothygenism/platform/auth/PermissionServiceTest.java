package com.robothygenism.platform.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PermissionServiceTest {
  private final PermissionService permissions = new PermissionService();

  @Test
  void usesDefinedPermissionsForUserAndMissionManagement() {
    assertThat(permissions.has(principal("TENANT_ADMIN"), "USER_MANAGE")).isTrue();
    assertThat(permissions.has(principal("OPERATOR"), "TASK_CONTROL")).isTrue();
  }

  private PlatformPrincipal principal(String role) {
    return new PlatformPrincipal(UUID.randomUUID(), "user@example.com", "User", role, UUID.randomUUID(), Set.of(), false,
        UUID.randomUUID(), "csrf", PlatformPrincipal.AuthMode.COOKIE);
  }
}
