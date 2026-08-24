package com.robothygenism.platform.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.auth.PlatformPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
  private final JdbcClient jdbc; private final ObjectMapper json;
  public AuditService(JdbcClient jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }
  public void record(PlatformPrincipal actor, HttpServletRequest request, String action, String resourceType, UUID resourceId, UUID tenantId, UUID projectId, Object before, Object after) {
    jdbc.sql("INSERT INTO \"AuditLog\" (id,\"actorUserId\",action,method,route,\"resourceType\",\"resourceId\",\"requestId\",\"ipAddress\",\"userAgent\",\"tenantId\",\"projectId\",\"beforeValue\",\"afterValue\",\"createdAt\") VALUES (:id,:actor,:action,:method,:route,:type,:resource,:requestId,:ip,:ua,:tenant,:project,CAST(:before AS jsonb),CAST(:after AS jsonb),CURRENT_TIMESTAMP)")
        .param("id", UUID.randomUUID()).param("actor", actor.id()).param("action", action).param("method", request.getMethod()).param("route", request.getRequestURI()).param("type", resourceType).param("resource", resourceId == null ? null : resourceId.toString()).param("requestId", request.getAttribute("requestId")).param("ip", request.getRemoteAddr()).param("ua", request.getHeader("User-Agent")).param("tenant", tenantId).param("project", projectId).param("before", safe(before)).param("after", safe(after)).update();
  }
  private String safe(Object value) { try { return value == null ? null : json.writeValueAsString(value); } catch (JsonProcessingException error) { return "{}"; } }
}

