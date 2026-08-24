package com.robothygenism.platform.config;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class SecurityConfigTest {
  @Test
  void permitsResumableUploadHeadersDuringCorsPreflight() {
    var properties = new PlatformProperties(
        "http://localhost:5173", false, 12, "http://localhost:3000", false, false,
        new PlatformProperties.Mqtt("tcp://localhost:1883", "java-api-test"));
    var source = new SecurityConfig().corsConfigurationSource(properties);
    var request = new MockHttpServletRequest("OPTIONS", "/api/v1/uploads/session/parts/1");
    request.addHeader("Origin", "http://localhost:5173");

    var configuration = source.getCorsConfiguration(request);

    assertNotNull(configuration);
    assertTrue(configuration.getAllowedHeaders().contains("Content-Range"));
    assertTrue(configuration.getAllowedHeaders().contains("X-Part-SHA256"));
    assertTrue(configuration.getAllowedHeaders().contains("X-CSRF-Token"));
    assertTrue(configuration.getAllowedHeaders().contains("Idempotency-Key"));
    assertTrue(configuration.getAllowedHeaders().contains("X-Request-ID"));
    assertTrue(configuration.getAllowedHeaders().contains("X-Trace-ID"));
    assertTrue(configuration.getAllowedHeaders().contains("traceparent"));
    assertTrue(configuration.getExposedHeaders().contains("X-Request-ID"));
    assertTrue(configuration.getExposedHeaders().contains("X-Trace-ID"));
  }
}
