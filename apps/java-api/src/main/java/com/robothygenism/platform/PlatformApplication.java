package com.robothygenism.platform;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PlatformApplication {
  public static void main(String[] args) {
    SpringApplication application = new SpringApplication(PlatformApplication.class);
    application.setDefaultProperties(loadRootEnvironment());
    application.run(args);
  }

  static Map<String, Object> loadRootEnvironment() {
    String explicit = System.getenv("ROBOT_PLATFORM_ENV_FILE");
    Path cursor = Path.of(System.getProperty("user.dir")).toAbsolutePath();
    Path env = explicit == null || explicit.isBlank() ? null : Path.of(explicit);
    while (env == null && cursor != null) {
      Path candidate = cursor.resolve(".env");
      if (Files.isRegularFile(candidate) && Files.isRegularFile(cursor.resolve("package.json"))) env = candidate;
      cursor = cursor.getParent();
    }
    Map<String, Object> values = new LinkedHashMap<>();
    if (env == null) return values;
    try {
      for (String line : Files.readAllLines(env)) {
        String value = line.trim();
        if (value.isEmpty() || value.startsWith("#") || !value.contains("=")) continue;
        int split = value.indexOf('=');
        String parsed = value.substring(split + 1).trim();
        if (parsed.length() >= 2 && parsed.startsWith("\"") && parsed.endsWith("\"")) parsed = parsed.substring(1, parsed.length() - 1);
        values.putIfAbsent(value.substring(0, split).trim(), parsed);
      }
      return values;
    } catch (IOException error) {
      throw new IllegalStateException("Unable to read repository-root .env", error);
    }
  }
}

