package com.robothygenism.platform.config;

import com.robothygenism.platform.auth.SessionAuthenticationFilter;
import com.robothygenism.platform.common.SecurityErrorWriter;
import com.robothygenism.platform.security.ControlRateLimitFilter;
import jakarta.servlet.DispatcherType;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean SecurityFilterChain security(HttpSecurity http, SessionAuthenticationFilter sessions, ControlRateLimitFilter rateLimits, SecurityErrorWriter errors) throws Exception {
    return http.csrf(csrf -> csrf.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .cors(cors -> {}).authorizeHttpRequests(auth -> auth
            .dispatcherTypeMatchers(DispatcherType.FORWARD, DispatcherType.ERROR).permitAll()
            .requestMatchers("/health", "/version", "/actuator/health", "/api/docs", "/api/docs/**", "/api/swagger-ui/**", "/swagger-ui/**", "/api/v1/openapi.yaml", "/api/v1/openapi.yaml/**").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/mobile/sessions").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/internal/v1/resilience/evidence").permitAll()
            .anyRequest().authenticated())
        .exceptionHandling(exceptions -> exceptions
            .authenticationEntryPoint((request, response, error) -> errors.write(request, response, 401, "AUTHENTICATION_REQUIRED", "Authentication required"))
            .accessDeniedHandler((request, response, error) -> errors.write(request, response, 403, "ACCESS_DENIED", "Access denied")))
        .addFilterBefore(sessions, UsernamePasswordAuthenticationFilter.class)
        .addFilterAfter(rateLimits, SessionAuthenticationFilter.class).build();
  }
  @Bean CorsConfigurationSource corsConfigurationSource(PlatformProperties properties) {
    var config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(properties.corsOrigin())); config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of(
        "Content-Type", "Content-Range", "X-Part-SHA256", "X-CSRF-Token", "X-Request-ID",
        "X-Trace-ID", "traceparent", "Idempotency-Key", "Last-Event-ID", "Authorization"));
    config.setExposedHeaders(List.of("Content-Range", "X-Request-ID", "X-Trace-ID", "traceparent"));
    config.setAllowCredentials(true);
    var source = new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**", config); return source;
  }
}
