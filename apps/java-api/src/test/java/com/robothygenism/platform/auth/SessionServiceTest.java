package com.robothygenism.platform.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

class SessionServiceTest {
  private final SessionService sessions = new SessionService(mock(JdbcClient.class));

  @Test
  void derivesStableCsrfTokenPerSessionWithoutSharingItAcrossSessions() {
    assertThat(sessions.csrfToken("session-a"))
        .isEqualTo(sessions.csrfToken("session-a"))
        .isNotEqualTo(sessions.csrfToken("session-b"));
  }
}
