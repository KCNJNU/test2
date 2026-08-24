package com.robothygenism.platform.safety;

import com.robothygenism.platform.common.ApiException;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class SafePolicyService {
  private final JdbcClient jdbc; public SafePolicyService(JdbcClient jdbc){this.jdbc=jdbc;}
  public void requireTaskAllowed(UUID robotId,String action){var active=jdbc.sql("SELECT code,latched,\"fullBlock\" FROM \"SafetyState\" WHERE \"robotId\"=:robot AND active=true ORDER BY \"occurredAt\" DESC LIMIT 1").param("robot",robotId).query().listOfRows().stream().findFirst();if(active.isPresent()){var state=active.get();if(Boolean.TRUE.equals(state.get("latched"))||Boolean.TRUE.equals(state.get("fullBlock")))throw new ApiException(HttpStatus.CONFLICT,"SAFETY_BLOCKED","Robot has an active safety block",Map.of("safeCode",state.get("code"),"action",action));}}
  public Map<String,Object> policy(String code){return jdbc.sql("SELECT code,meaning,severity::text severity,latched,\"fullBlock\",\"requiresOnsiteHandling\",\"allowAutoRecovery\",configured,\"handlingSuggestion\" FROM \"SafetyPolicy\" WHERE code=:code").param("code",code).query().listOfRows().stream().findFirst().orElse(Map.of("code",code,"meaning","Policy not configured","severity","LATCHED","latched",true,"fullBlock",true,"requiresOnsiteHandling",true,"allowAutoRecovery",false,"configured",false,"handlingSuggestion","On-site handling required."));}
}



