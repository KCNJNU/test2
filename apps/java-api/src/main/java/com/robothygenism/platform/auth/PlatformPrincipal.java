package com.robothygenism.platform.auth;

import java.util.Set;
import java.util.UUID;

public record PlatformPrincipal(UUID id, String email, String displayName, String role, UUID tenantId, Set<UUID> projectIds, boolean mustChangePassword, UUID sessionId, String csrfTokenHash, AuthMode authMode) {
  public enum AuthMode { COOKIE, BEARER }
  public boolean superAdmin() { return role.equals("SUPER_ADMIN"); }
}

