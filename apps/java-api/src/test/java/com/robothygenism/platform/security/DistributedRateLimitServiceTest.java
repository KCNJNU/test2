package com.robothygenism.platform.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

class DistributedRateLimitServiceTest {
  @Test void hashesSensitiveLimiterIdentityWithEnvironmentSalt() {
    var service=new DistributedRateLimitService(mock(StringRedisTemplate.class),"production-random-salt");
    String hash=service.hash("192.0.2.3:person@example.com");
    assertEquals(64,hash.length());
    assertFalse(hash.contains("person"));
    assertFalse(hash.contains("192.0.2.3"));
  }

  @Test void rateLimitResponseCarriesStableCodeAndRetryWindow() {
    var error=new DistributedRateLimitService.RateLimitException(60);
    assertEquals("RATE_LIMITED",error.code());
    assertEquals(60,error.retryAfter());
  }
}
