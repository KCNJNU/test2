package com.robothygenism.platform.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SharedPasswordServiceTest {
  private final SharedPasswordService passwords = new SharedPasswordService();

  @Test
  void acceptsNodeArgon2ParameterOrder() {
    String password = "correct-horse-battery-staple";
    String springHash = passwords.encode(password);
    String nodeHash = springHash.replaceFirst(
        "\\$m=(\\d+),t=(\\d+),p=(\\d+)\\$", "\\$m=$1,p=$3,t=$2\\$");

    assertTrue(passwords.matches(password, nodeHash));
    assertFalse(passwords.matches("wrong-password", nodeHash));
  }

  @Test
  void malformedHashIsAnAuthenticationFailure() {
    assertFalse(passwords.matches("password", "not-an-argon2-hash"));
  }
}
