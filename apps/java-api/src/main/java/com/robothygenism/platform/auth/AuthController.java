package com.robothygenism.platform.auth;

import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.config.PlatformProperties;
import com.robothygenism.platform.security.DistributedRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AuthController {
  private final JdbcClient jdbc; private final SessionService sessions; private final PlatformProperties properties; private final SharedPasswordService passwords; private final DistributedRateLimitService rateLimits;
  private final SecureRandom random = new SecureRandom();
  public AuthController(JdbcClient jdbc, SessionService sessions, PlatformProperties properties, SharedPasswordService passwords, DistributedRateLimitService rateLimits) { this.jdbc = jdbc; this.sessions = sessions; this.properties = properties; this.passwords = passwords; this.rateLimits = rateLimits; }

  @PostMapping("/auth/login") @Transactional
  public Map<String, Object> login(@Valid @RequestBody Login request, HttpServletRequest servletRequest, HttpServletResponse response) {
    rateLimits.require("login", servletRequest.getRemoteAddr()+":"+request.email().trim().toLowerCase(), 10, 60);
    var user = authenticate(request); var tokens = issue(user.id());
    ResponseCookie cookie = ResponseCookie.from("cr_session", tokens.sessionToken()).httpOnly(true).secure(properties.cookieSecure()).sameSite("Lax").path("/").maxAge(Duration.ofHours(properties.sessionHours())).build();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    return Map.of("user", userPayload(user), "csrfToken", tokens.csrfToken(), "expiresAt", tokens.expiresAt());
  }

  @PostMapping("/mobile/sessions") @Transactional
  public Map<String, Object> mobile(@Valid @RequestBody Login request, HttpServletRequest servletRequest) { rateLimits.require("login", servletRequest.getRemoteAddr()+":"+request.email().trim().toLowerCase(), 10, 60); var user = authenticate(request); var tokens = issue(user.id()); return Map.of("user", userPayload(user), "accessToken", tokens.sessionToken(), "expiresAt", tokens.expiresAt()); }

  @GetMapping("/auth/session")
  public Map<String, Object> session(Authentication authentication) {
    PlatformPrincipal principal = (PlatformPrincipal) authentication.getPrincipal(); String csrf = sessions.csrfToken(String.valueOf(authentication.getCredentials()));
    jdbc.sql("UPDATE \"Session\" SET \"csrfTokenHash\"=:hash WHERE id=:id").param("hash", sessions.hash(csrf)).param("id", principal.sessionId()).update();
    return Map.of("user", principalPayload(principal), "csrfToken", csrf);
  }

  @PostMapping("/auth/logout")
  public Map<String, Object> logout(Authentication authentication, HttpServletResponse response) {
    PlatformPrincipal principal = (PlatformPrincipal) authentication.getPrincipal(); jdbc.sql("DELETE FROM \"Session\" WHERE id=:id").param("id", principal.sessionId()).update();
    response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("cr_session", "").path("/").maxAge(Duration.ZERO).build().toString()); return Map.of("success", true);
  }

  @PostMapping("/auth/change-password") @Transactional
  public Map<String,Object> changePassword(@Valid @RequestBody ChangePassword request, Authentication authentication, HttpServletResponse response) {
    PlatformPrincipal principal=(PlatformPrincipal)authentication.getPrincipal();
    String current=jdbc.sql("SELECT \"passwordHash\" FROM \"User\" WHERE id=:id").param("id",principal.id()).query(String.class).single();
    if(!passwords.matches(request.currentPassword(),current)) throw new ApiException(HttpStatus.FORBIDDEN,"CURRENT_PASSWORD_INVALID","Current password is incorrect");
    jdbc.sql("UPDATE \"User\" SET \"passwordHash\"=:hash,\"mustChangePassword\"=false,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("hash",passwords.encode(request.newPassword())).param("id",principal.id()).update();
    jdbc.sql("DELETE FROM \"Session\" WHERE \"userId\"=:id").param("id",principal.id()).update();
    response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("cr_session","").path("/").maxAge(Duration.ZERO).build().toString());return Map.of("success",true,"reauthenticate",true);
  }

  private UserRow authenticate(Login request) {
    var user = jdbc.sql("SELECT id,email,\"displayName\",\"passwordHash\",role::text role,\"tenantId\",\"mustChangePassword\",\"isActive\",\"failedLoginCount\",\"lockedUntil\" FROM \"User\" WHERE lower(email)=lower(:email)")
        .param("email", request.email().trim()).query((rs, n) -> new UserRow((UUID) rs.getObject("id"), rs.getString("email"), rs.getString("displayName"), rs.getString("passwordHash"), rs.getString("role"), (UUID) rs.getObject("tenantId"), rs.getBoolean("mustChangePassword"), rs.getBoolean("isActive"), rs.getInt("failedLoginCount"), rs.getObject("lockedUntil", OffsetDateTime.class))).optional()
        .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password"));
    if (!user.active() || user.lockedUntil() != null && user.lockedUntil().isAfter(OffsetDateTime.now())) throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_LOCKED", "Account is unavailable or temporarily locked");
    if (!passwords.matches(request.password(), user.passwordHash())) {
      jdbc.sql("UPDATE \"User\" SET \"failedLoginCount\"=CASE WHEN \"failedLoginCount\">=4 THEN 0 ELSE \"failedLoginCount\"+1 END, \"lockedUntil\"=CASE WHEN \"failedLoginCount\">=4 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE NULL END WHERE id=:id").param("id", user.id()).update();
      throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
    }
    jdbc.sql("UPDATE \"User\" SET \"failedLoginCount\"=0, \"lockedUntil\"=NULL, \"lastLoginAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("id", user.id()).update(); return user;
  }
  private Tokens issue(UUID userId) { String session = token(), csrf = sessions.csrfToken(session); OffsetDateTime expires = OffsetDateTime.now().plusHours(properties.sessionHours()); jdbc.sql("INSERT INTO \"Session\" (id,\"userId\",\"tokenHash\",\"csrfTokenHash\",\"expiresAt\",\"lastSeenAt\",\"createdAt\") VALUES (:id,:user,:token,:csrf,:expires,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id", UUID.randomUUID()).param("user", userId).param("token", sessions.hash(session)).param("csrf", sessions.hash(csrf)).param("expires", expires).update(); return new Tokens(session, csrf, expires); }
  private String token() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
  private Map<String, Object> userPayload(UserRow user) { return Map.of("id", user.id(), "email", user.email(), "displayName", user.displayName(), "role", user.role().equals("ADMIN") ? "SUPER_ADMIN" : user.role(), "tenantId", user.tenantId() == null ? "" : user.tenantId().toString(), "mustChangePassword", user.mustChangePassword()); }
  private Map<String, Object> principalPayload(PlatformPrincipal p) { return Map.of("id", p.id(), "email", p.email(), "displayName", p.displayName(), "role", p.role(), "tenantId", p.tenantId() == null ? "" : p.tenantId(), "projectIds", p.projectIds(), "mustChangePassword", p.mustChangePassword()); }
  public record Login(@Email String email, @NotBlank String password) {}
  public record ChangePassword(@NotBlank String currentPassword, @Size(min=12) String newPassword) {}
  private record UserRow(UUID id, String email, String displayName, String passwordHash, String role, UUID tenantId, boolean mustChangePassword, boolean active, int failed, OffsetDateTime lockedUntil) {}
  private record Tokens(String sessionToken, String csrfToken, OffsetDateTime expiresAt) {}
}
