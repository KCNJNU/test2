package com.robothygenism.platform.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import com.robothygenism.platform.security.DistributedRateLimitService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<?> api(ApiException error, HttpServletRequest request) {
    var response = ResponseEntity.status(error.status());
    if (error instanceof DistributedRateLimitService.RateLimitException limited) response.header("Retry-After", Integer.toString(limited.retryAfter()));
    return response.body(body(error.code(), error.getMessage(), request, error.details()));
  }
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException error, HttpServletRequest request) {
    var fields = error.getBindingResult().getFieldErrors().stream().collect(java.util.stream.Collectors.toMap(e -> e.getField(), e -> e.getDefaultMessage() == null ? "Invalid" : e.getDefaultMessage(), (a, b) -> a));
    return ResponseEntity.badRequest().body(body("VALIDATION_ERROR", "Request validation failed", request, Map.of("fields", fields)));
  }
  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<?> notFound(NoResourceFoundException error, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body("RESOURCE_NOT_FOUND", "Resource not found", request, Map.of()));
  }
  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unexpected(Exception error, HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body("INTERNAL_ERROR", "Internal server error", request, Map.of()));
  }
  private Map<String, Object> body(String code, String message, HttpServletRequest request, Map<String, Object> details) {
    return Map.of("code", code, "message", message, "requestId", request.getAttribute("requestId"), "details", details);
  }
}
