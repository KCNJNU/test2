package com.robothygenism.platform.tenancy;

import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class ScopeService {
  private final JdbcClient jdbc;
  public ScopeService(JdbcClient jdbc) { this.jdbc = jdbc; }
  public UUID tenant(PlatformPrincipal principal, UUID requested) {
    if (principal.superAdmin()) {
      if (requested == null) throw new ApiException(HttpStatus.BAD_REQUEST, "TENANT_REQUIRED", "tenantId is required for a super administrator write");
      return requested;
    }
    if (principal.tenantId() == null || requested != null && !requested.equals(principal.tenantId())) throw new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Resource not found");
    return principal.tenantId();
  }
  public void project(PlatformPrincipal principal, UUID projectId) {
    boolean exists = jdbc.sql("SELECT EXISTS(SELECT 1 FROM \"Project\" WHERE id=:id AND \"status\"='ACTIVE')").param("id", projectId).query(Boolean.class).single();
    if (!exists) throw new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Project not found");
    if (principal.superAdmin() || principal.role().equals("TENANT_ADMIN") && jdbc.sql("SELECT \"tenantId\"=:tenant FROM \"Project\" WHERE id=:id").param("tenant", principal.tenantId()).param("id", projectId).query(Boolean.class).single() || principal.projectIds().contains(projectId)) return;
    throw new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Project not found");
  }
}

