package com.robothygenism.platform.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.common.SecurityErrorWriter;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SessionAuthenticationFilterTest {
  @Test
  void returnsStructuredCsrfErrorWithoutCallingTheApplication() throws Exception {
    var sessions = mock(SessionService.class);
    var principal = new PlatformPrincipal(UUID.randomUUID(), "admin@example.com", "Admin", "SUPER_ADMIN", null, Set.of(), false,
        UUID.randomUUID(), "expected-hash", PlatformPrincipal.AuthMode.COOKIE);
    when(sessions.resolve("session-token", PlatformPrincipal.AuthMode.COOKIE)).thenReturn(Optional.of(principal));
    when(sessions.hash("stale-token")).thenReturn("stale-hash");
    var filter = new SessionAuthenticationFilter(sessions, new SecurityErrorWriter(new ObjectMapper()));
    var request = new MockHttpServletRequest("PUT", "/api/v1/uploads/session/parts/1");
    request.setCookies(new jakarta.servlet.http.Cookie("cr_session", "session-token"));
    request.addHeader("X-CSRF-Token", "stale-token");
    var response = new MockHttpServletResponse();
    var chain = new MockFilterChain();

    filter.doFilter(request, response, chain);

    assertEquals(403, response.getStatus());
    assertFalse(response.getContentAsString().isBlank());
    assertEquals("CSRF_INVALID", new ObjectMapper().readTree(response.getContentAsByteArray()).get("code").asText());
  }
}
