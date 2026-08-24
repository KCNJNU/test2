package com.robothygenism.platform.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class SecurityErrorWriter {
  private final ObjectMapper json;

  public SecurityErrorWriter(ObjectMapper json) {
    this.json = json;
  }

  public void write(HttpServletRequest request, HttpServletResponse response, int status, String code, String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    json.writeValue(response.getOutputStream(), Map.of(
        "code", code,
        "message", message,
        "requestId", Objects.toString(request.getAttribute("requestId"), ""),
        "details", Map.of()));
  }
}
