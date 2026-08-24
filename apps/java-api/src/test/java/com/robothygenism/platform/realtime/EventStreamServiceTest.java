package com.robothygenism.platform.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import com.robothygenism.platform.auth.PlatformPrincipal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EventStreamServiceTest {
  @Test
  void registersScopedSubscriptionsWithoutSharingScopeState() {
    var service = new EventStreamService();
    var tenantA = UUID.randomUUID();
    var tenantB = UUID.randomUUID();
    var projectA = UUID.randomUUID();

    service.subscribe(principal("OPERATOR", tenantA, Set.of(projectA)));
    service.subscribe(principal("TENANT_ADMIN", tenantB, Set.of()));

    assertThat(service.subscriptionCount()).isEqualTo(2);
  }

  @Test
  void rejectsCrossTenantAndUnauthorizedProjectEvents() {
    var tenantA = UUID.randomUUID();
    var tenantB = UUID.randomUUID();
    var projectA = UUID.randomUUID();
    var projectB = UUID.randomUUID();

    assertThat(EventStreamService.canRead(false, "OPERATOR", tenantA, Set.of(projectA), tenantA, projectA)).isTrue();
    assertThat(EventStreamService.canRead(false, "OPERATOR", tenantA, Set.of(projectA), tenantA, projectB)).isFalse();
    assertThat(EventStreamService.canRead(false, "OPERATOR", tenantA, Set.of(projectA), tenantB, projectA)).isFalse();
    assertThat(EventStreamService.canRead(false, "TENANT_ADMIN", tenantA, Set.of(), tenantA, projectB)).isTrue();
    assertThat(EventStreamService.canRead(false, "TENANT_ADMIN", tenantA, Set.of(), tenantB, projectB)).isFalse();
    assertThat(EventStreamService.canRead(true, "SUPER_ADMIN", null, Set.of(), tenantB, projectB)).isTrue();
  }

  private PlatformPrincipal principal(String role, UUID tenantId, Set<UUID> projects) {
    return new PlatformPrincipal(UUID.randomUUID(), "user@example.com", "User", role, tenantId, projects, false,
        UUID.randomUUID(), "csrf", PlatformPrincipal.AuthMode.COOKIE);
  }
}
