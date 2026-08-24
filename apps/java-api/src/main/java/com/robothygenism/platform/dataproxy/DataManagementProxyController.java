package com.robothygenism.platform.dataproxy;

import com.robothygenism.platform.config.PlatformProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@RestController
public class DataManagementProxyController {
  private static final Set<String> RESPONSE_HEADERS_OWNED_BY_JAVA = Set.of(
      "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods",
      "access-control-allow-headers", "access-control-expose-headers", "access-control-max-age", "vary",
      "x-request-id", "connection", "transfer-encoding", "content-length");

  private final RestClient client;

  public DataManagementProxyController(RestClient.Builder builder, PlatformProperties properties) {
    client = builder.baseUrl(properties.nestBaseUrl()).build();
  }

  @RequestMapping({
      "/api/v1/files/**", "/api/v1/datasets/**", "/api/v1/uploads/**", "/api/v1/jobs/**",
      "/api/v1/storage/**", "/api/v1/tags/**", "/api/v1/saved-views/**", "/api/v1/search/**",
      "/api/v1/activity/**", "/api/v1/notifications/**", "/api/v1/system/**", "/api/v1/users/**",
      "/api/v1/audit-logs/page", "/api/v1/audit-logs/export"
  })
  public ResponseEntity<byte[]> proxy(HttpServletRequest request) throws IOException {
    String path = request.getRequestURI() + (request.getQueryString() == null ? "" : "?" + request.getQueryString());
    var spec = client.method(HttpMethod.valueOf(request.getMethod())).uri(path);
    Collections.list(request.getHeaderNames()).forEach(name -> {
      if (!name.equalsIgnoreCase(HttpHeaders.HOST) && !name.equalsIgnoreCase(HttpHeaders.CONTENT_LENGTH)) {
        spec.header(name, Collections.list(request.getHeaders(name)).toArray(String[]::new));
      }
    });
    byte[] body = StreamUtils.copyToByteArray(request.getInputStream());
    var response = (body.length == 0 ? spec : spec.body(body)).retrieve()
        .onStatus(status -> status.isError(), (upstreamRequest, upstreamResponse) -> {})
        .toEntity(byte[].class);
    var headers = new HttpHeaders();
    response.getHeaders().forEach((name, values) -> {
      if (!RESPONSE_HEADERS_OWNED_BY_JAVA.contains(name.toLowerCase(Locale.ROOT))) headers.put(name, values);
    });
    return ResponseEntity.status(response.getStatusCode()).headers(headers).body(response.getBody());
  }
}
