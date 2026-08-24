package com.robothygenism.platform.common;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VersionController {
  private static final Pattern SERVICE = Pattern.compile("[A-Za-z0-9._-]{1,64}");
  private static final Pattern VERSION = Pattern.compile("v?\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?");
  private static final Pattern COMMIT = Pattern.compile("[0-9a-fA-F]{7,40}");
  private final Map<String, String> build;

  public VersionController(
      @Value("${RUNTIME_SERVICE_NAME:java-api}") String service,
      @Value("${APP_VERSION:0.0.0-dev}") String version,
      @Value("${GIT_COMMIT:unknown}") String gitCommit,
      @Value("${BUILD_TIME:unknown}") String buildTime) {
    this.build = Map.of(
        "service", valid(service, SERVICE, "java-api"),
        "version", valid(version, VERSION, "0.0.0-dev"),
        "gitCommit", valid(gitCommit, COMMIT, "unknown").toLowerCase(),
        "buildTime", time(buildTime));
  }

  @GetMapping("/version")
  public Map<String, String> version() { return build; }

  private static String valid(String value, Pattern pattern, String fallback) {
    return value != null && pattern.matcher(value).matches() ? value : fallback;
  }

  private static String time(String value) {
    try { return Instant.parse(value).toString(); }
    catch (DateTimeParseException | NullPointerException ignored) { return "unknown"; }
  }
}
