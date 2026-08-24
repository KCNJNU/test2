package com.robothygenism.platform.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class SessionService {
  private final JdbcClient jdbc;
  public SessionService(JdbcClient jdbc) { this.jdbc = jdbc; }

  public Optional<PlatformPrincipal> resolve(String token, PlatformPrincipal.AuthMode mode) {
    var user = jdbc.sql("""
        SELECT s.id session_id, s."csrfTokenHash", s."expiresAt", u.id, u.email, u."displayName", u.role::text role,
               u."tenantId", u."mustChangePassword", u."isActive"
        FROM "Session" s JOIN "User" u ON u.id=s."userId" WHERE s."tokenHash"=:hash
        """).param("hash", hash(token)).query(this::principal).optional();
    if (user.isEmpty() || user.get().expiresAt().isBefore(OffsetDateTime.now()) || !user.get().active()) return Optional.empty();
    var row = user.get();
    Set<UUID> projects = jdbc.sql("SELECT \"projectId\" FROM \"UserProjectAccess\" WHERE \"userId\"=:id").param("id", row.id()).query(UUID.class).list().stream().collect(Collectors.toUnmodifiableSet());
    jdbc.sql("UPDATE \"Session\" SET \"lastSeenAt\"=CURRENT_TIMESTAMP WHERE id=:id AND \"lastSeenAt\" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'").param("id", row.sessionId()).update();
    String role = row.role().equals("ADMIN") ? "SUPER_ADMIN" : row.role();
    return Optional.of(new PlatformPrincipal(row.id(), row.email(), row.displayName(), role, row.tenantId(), projects, row.mustChangePassword(), row.sessionId(), row.csrfHash(), mode));
  }

  public String hash(String token) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
    catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
  }

  public String csrfToken(String sessionToken) { return hash("csrf:" + sessionToken); }

  private SessionRow principal(ResultSet rs, int ignored) throws SQLException {
    return new SessionRow((UUID) rs.getObject("id"), rs.getString("email"), rs.getString("displayName"), rs.getString("role"), (UUID) rs.getObject("tenantId"), rs.getBoolean("mustChangePassword"), (UUID) rs.getObject("session_id"), rs.getString("csrfTokenHash"), rs.getObject("expiresAt", OffsetDateTime.class), rs.getBoolean("isActive"));
  }
  private record SessionRow(UUID id, String email, String displayName, String role, UUID tenantId, boolean mustChangePassword, UUID sessionId, String csrfHash, OffsetDateTime expiresAt, boolean active) {}
}
