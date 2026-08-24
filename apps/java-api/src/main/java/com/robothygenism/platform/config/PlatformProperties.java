package com.robothygenism.platform.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "platform")
public record PlatformProperties(
    @NotBlank String corsOrigin,
    boolean cookieSecure,
    @Positive int sessionHours,
    @NotBlank String nestBaseUrl,
    boolean deviceCommandsEnabled,
    boolean simulatorEnabled,
    Mqtt mqtt) {
  public record Mqtt(@NotBlank String brokerUri, @NotBlank String clientId) {}
}

