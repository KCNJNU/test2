package com.robothygenism.platform.auth;

import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;

/** Keeps Java compatible with Argon2id PHC strings emitted by node-argon2. */
@Service
public class SharedPasswordService {
  private final Argon2PasswordEncoder delegate = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();

  public String encode(String rawPassword) {
    return delegate.encode(rawPassword);
  }

  public boolean matches(String rawPassword, String encodedPassword) {
    if (encodedPassword == null || !encodedPassword.startsWith("$argon2id$")) return false;
    // node-argon2 emits m,p,t while Spring Security's decoder requires m,t,p.
    String normalized = encodedPassword.replaceFirst(
        "\\$m=(\\d+),p=(\\d+),t=(\\d+)\\$", "\\$m=$1,t=$3,p=$2\\$");
    try {
      return delegate.matches(rawPassword, normalized);
    } catch (IllegalArgumentException malformedHash) {
      return false;
    }
  }
}
