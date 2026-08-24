package com.robothygenism.platform.robot;

import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.tenancy.ScopeService;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/robots")
public class RobotController {
  private final JdbcClient jdbc; private final ScopeService scope; private final PermissionService permissions;
  public RobotController(JdbcClient jdbc, ScopeService scope, PermissionService permissions){this.jdbc=jdbc;this.scope=scope;this.permissions=permissions;}
  @GetMapping public Map<String,Object> list(@RequestParam(required=false) UUID projectId,Authentication auth){var p=principal(auth);if(projectId!=null)scope.project(p,projectId);var spec=projectId!=null?jdbc.sql(base()+" WHERE r.\"projectId\"=:project ORDER BY r.name").param("project",projectId):p.superAdmin()?jdbc.sql(base()+" ORDER BY r.name"):p.role().equals("TENANT_ADMIN")?jdbc.sql(base()+" WHERE r.\"tenantId\"=:tenant ORDER BY r.name").param("tenant",p.tenantId()):jdbc.sql(base()+" WHERE r.\"projectId\" IN (SELECT \"projectId\" FROM \"UserProjectAccess\" WHERE \"userId\"=:user) ORDER BY r.name").param("user",p.id());var rows=spec.query().listOfRows();return Map.of("items",rows,"total",rows.size(),"page",1,"pageSize",rows.size());}
  @GetMapping("/{id}") public Map<String,Object> detail(@PathVariable UUID id,Authentication auth){var p=principal(auth);var row=jdbc.sql(base()+" WHERE r.id=:id").param("id",id).query().singleRow();scope.project(p,(UUID)row.get("projectId"));return row;}
  @GetMapping("/{id}/telemetry") public Map<String,Object> telemetry(@PathVariable UUID id,Authentication auth){detail(id,auth);return jdbc.sql("SELECT * FROM \"TelemetrySample\" WHERE \"robotId\"=:id ORDER BY \"deviceTimestamp\" DESC LIMIT 500").param("id",id).query().listOfRows().stream().findFirst().orElse(Map.of("status","NOT_AVAILABLE"));}
  @GetMapping("/{id}/health") public Map<String,Object> health(@PathVariable UUID id,Authentication auth){detail(id,auth);return jdbc.sql("SELECT resources,sensors,\"deviceTimestamp\",\"receivedAt\" FROM \"RobotHealthSnapshot\" WHERE \"robotId\"=:id ORDER BY \"deviceTimestamp\" DESC LIMIT 1").param("id",id).query().listOfRows().stream().findFirst().orElse(Map.of("status","NOT_AVAILABLE"));}
  private String base(){return "SELECT r.id,r.name \"robotName\",r.\"externalId\" \"robotSn\",r.\"tenantId\",r.\"projectId\",r.\"siteId\",r.\"floorId\",r.\"onlineStatus\"::text \"onlineStatus\",r.\"operationalState\"::text \"operationalState\",r.\"safetyCode\",r.\"batteryPercent\",r.\"chargingState\"::text \"chargingState\",r.\"currentTaskId\",r.\"softwareVersion\",r.\"mcuVersion\",r.\"configVersion\",r.\"lastOnlineAt\",r.\"lastTelemetryAt\",p.name \"projectName\",s.name \"siteName\",f.name \"floorName\" FROM \"Robot\" r LEFT JOIN \"Project\" p ON p.id=r.\"projectId\" LEFT JOIN \"Site\" s ON s.id=r.\"siteId\" LEFT JOIN \"Floor\" f ON f.id=r.\"floorId\"";}
  private PlatformPrincipal principal(Authentication auth){return (PlatformPrincipal)auth.getPrincipal();}
}


