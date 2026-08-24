package com.robothygenism.platform.auth;

import com.robothygenism.platform.common.SecurityErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
  private final SessionService sessions;
  private final SecurityErrorWriter errors;
  public SessionAuthenticationFilter(SessionService sessions, SecurityErrorWriter errors) { this.sessions = sessions; this.errors = errors; }

  @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    String bearer = request.getHeader("Authorization");
    PlatformPrincipal.AuthMode mode = bearer != null && bearer.startsWith("Bearer ") ? PlatformPrincipal.AuthMode.BEARER : PlatformPrincipal.AuthMode.COOKIE;
    String token = mode == PlatformPrincipal.AuthMode.BEARER ? bearer.substring(7) : cookie(request);
    if (token != null) {
      var principal = sessions.resolve(token, mode).orElse(null);
      if (principal != null) {
        if (principal.authMode() == PlatformPrincipal.AuthMode.COOKIE && mutating(request.getMethod()) && !csrfValid(request.getHeader("X-CSRF-Token"), principal.csrfTokenHash())) {
          errors.write(request, response, HttpServletResponse.SC_FORBIDDEN, "CSRF_INVALID", "Invalid CSRF token");
          return;
        }
        var auth = new UsernamePasswordAuthenticationToken(principal, token, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
        SecurityContextHolder.getContext().setAuthentication(auth);
      }
    }
    chain.doFilter(request, response);
  }
  private String cookie(HttpServletRequest request) {
    if (request.getCookies() == null) return null;
    for (Cookie cookie : request.getCookies()) if (cookie.getName().equals("cr_session")) return cookie.getValue();
    return null;
  }
  private boolean mutating(String method) { return !SetHolder.SAFE.contains(method); }
  private boolean csrfValid(String token, String expected) { return token != null && expected != null && MessageDigest.isEqual(sessions.hash(token).getBytes(StandardCharsetsHolder.UTF8), expected.getBytes(StandardCharsetsHolder.UTF8)); }
  private static final class SetHolder { private static final java.util.Set<String> SAFE = java.util.Set.of("GET", "HEAD", "OPTIONS"); }
  private static final class StandardCharsetsHolder { private static final java.nio.charset.Charset UTF8 = java.nio.charset.StandardCharsets.UTF_8; }
}
