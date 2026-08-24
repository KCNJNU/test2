package com.robothygenism.platform.common;
import java.time.OffsetDateTime;import java.util.Map;import org.springframework.jdbc.core.simple.JdbcClient;import org.springframework.web.bind.annotation.GetMapping;import org.springframework.web.bind.annotation.RestController;
@RestController public class HealthController{private final JdbcClient jdbc;public HealthController(JdbcClient j){jdbc=j;}@GetMapping("/health")public Map<String,Object>health(){jdbc.sql("SELECT 1").query(Integer.class).single();return Map.of("status","healthy","timestamp",OffsetDateTime.now(),"services",Map.of("api",Map.of("status","healthy"),"postgresql",Map.of("status","healthy")));}}

