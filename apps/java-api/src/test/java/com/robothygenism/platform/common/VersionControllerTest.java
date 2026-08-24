package com.robothygenism.platform.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VersionControllerTest {
  @Test void exposesValidatedBuildMetadata() {
    var result = new VersionController("java-api", "v1.2.3", "ABCDEF0123456789ABCDEF0123456789ABCDEF01", "2026-08-23T00:00:00Z").version();
    assertThat(result).containsEntry("service", "java-api").containsEntry("version", "v1.2.3")
        .containsEntry("gitCommit", "abcdef0123456789abcdef0123456789abcdef01")
        .containsEntry("buildTime", "2026-08-23T00:00:00Z");
  }

  @Test void neverEchoesMalformedSecretBearingValues() {
    var result = new VersionController("java?token=secret", "password=secret", "secret", "secret").version();
    assertThat(result).containsEntry("service", "java-api").containsEntry("version", "0.0.0-dev")
        .containsEntry("gitCommit", "unknown").containsEntry("buildTime", "unknown");
    assertThat(result.toString()).doesNotContain("secret");
  }
}
