package com.robothygenism.platform.security;

import com.robothygenism.platform.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class DistributedRateLimitService {
  private static final DefaultRedisScript<Long> SCRIPT = new DefaultRedisScript<>(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", Long.class);
  private final StringRedisTemplate redis;
  private final String salt;

  public DistributedRateLimitService(StringRedisTemplate redis, @Value("${d6.rate-limit.key-salt}") String salt) {
    this.redis = redis; this.salt = salt;
  }

  public void require(String policy, String identity, int limit, int windowSeconds) {
    try {
      Long count = redis.execute(SCRIPT, List.of("rate:" + policy + ":" + hash(identity)), Integer.toString(windowSeconds));
      if (count == null) throw new IllegalStateException("No Redis result");
      if (count > limit) throw new RateLimitException(windowSeconds);
    } catch (RateLimitException error) { throw error; }
    catch (Exception error) { throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "RATE_LIMIT_DEPENDENCY_UNAVAILABLE", "Control operation is temporarily unavailable"); }
  }

  String hash(String value) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((salt + ":" + value).getBytes(StandardCharsets.UTF_8))); }
    catch (Exception error) { throw new IllegalStateException("SHA-256 unavailable"); }
  }

  public static final class RateLimitException extends ApiException {
    private final int retryAfter;
    public RateLimitException(int retryAfter) { super(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Rate limit exceeded"); this.retryAfter = retryAfter; }
    public int retryAfter() { return retryAfter; }
  }
}
