package com.robothygenism.platform.operations;

import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.tenancy.ScopeService;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1")
public class PlatformExtrasController {
  private final JdbcClient jdbc;private final PermissionService permissions;private final ScopeService scope;private final Argon2PasswordEncoder passwords=Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
  public PlatformExtrasController(JdbcClient jdbc,PermissionService permissions,ScopeService scope){this.jdbc=jdbc;this.permissions=permissions;this.scope=scope;}
  @GetMapping("/users") public Map<String,Object> users(Authentication auth){var p=p(auth);permissions.require(p,"USER_MANAGE");var rows=p.superAdmin()?jdbc.sql("SELECT id,email,\"displayName\",role::text role,\"tenantId\",\"isActive\",\"lastLoginAt\",\"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC").query().listOfRows():jdbc.sql("SELECT id,email,\"displayName\",role::text role,\"tenantId\",\"isActive\",\"lastLoginAt\",\"createdAt\" FROM \"User\" WHERE \"tenantId\"=:tenant ORDER BY \"createdAt\" DESC").param("tenant",p.tenantId()).query().listOfRows();return page(rows);}
  @PostMapping("/users") public Map<String,Object> createUser(@RequestBody UserRequest r,Authentication auth){var p=p(auth);permissions.require(p,"USER_MANAGE");UUID tenant=scope.tenant(p,r.tenantId()),id=UUID.randomUUID();jdbc.sql("INSERT INTO \"User\" (id,email,\"displayName\",\"passwordHash\",role,\"tenantId\",\"isActive\",\"mustChangePassword\",\"createdAt\",\"updatedAt\") VALUES (:id,lower(:email),:name,:hash,CAST(:role AS \"UserRole\"),:tenant,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("email",r.email()).param("name",r.displayName()).param("hash",passwords.encode(r.temporaryPassword())).param("role",r.role()).param("tenant",tenant).update();return Map.of("id",id,"email",r.email(),"displayName",r.displayName(),"role",r.role(),"tenantId",tenant,"mustChangePassword",true);}
  @GetMapping("/mission-templates") public Map<String,Object> templates(Authentication auth){return page(scoped("MissionTemplate",p(auth),"updatedAt"));}
  @PostMapping("/mission-templates") public Map<String,Object> template(@RequestBody TemplateRequest r,Authentication auth){var p=p(auth);permissions.require(p,"TASK_CONTROL");scope.project(p,r.projectId());UUID id=UUID.randomUUID(),tenant=jdbc.sql("SELECT \"tenantId\" FROM \"Project\" WHERE id=:id").param("id",r.projectId()).query(UUID.class).single();jdbc.sql("INSERT INTO \"MissionTemplate\" (id,\"tenantId\",\"projectId\",name,description,status,definition,\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:name,:description,'ACTIVE',CAST(:definition AS jsonb),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("tenant",tenant).param("project",r.projectId()).param("name",r.name()).param("description",r.description()).param("definition",r.definitionJson()).update();return Map.of("id",id,"name",r.name());}
  @GetMapping("/diagnostic-bundles") public Map<String,Object> diagnostics(Authentication auth){return page(scoped("DiagnosticBundle",p(auth),"createdAt"));}
  @GetMapping("/mobile/devices") public Map<String,Object> mobileDevices(Authentication auth){var p=p(auth);return page(jdbc.sql("SELECT id,platform,\"lastSeenAt\",\"createdAt\" FROM \"PushDevice\" WHERE \"userId\"=:user ORDER BY \"lastSeenAt\" DESC").param("user",p.id()).query().listOfRows());}
  @PostMapping("/mobile/push-tokens") public Map<String,Object> push(@RequestBody PushRequest r,Authentication auth){var p=p(auth);UUID id=UUID.randomUUID();jdbc.sql("INSERT INTO \"PushDevice\" (id,\"userId\",platform,\"pushToken\",\"lastSeenAt\",\"createdAt\") VALUES (:id,:user,:platform,:token,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (\"pushToken\") DO UPDATE SET \"userId\"=EXCLUDED.\"userId\",platform=EXCLUDED.platform,\"lastSeenAt\"=CURRENT_TIMESTAMP").param("id",id).param("user",p.id()).param("platform",r.platform()).param("token",r.token()).update();return Map.of("registered",true);}
  private java.util.List<Map<String,Object>> scoped(String table,PlatformPrincipal p,String order){return p.superAdmin()?jdbc.sql("SELECT * FROM \""+table+"\" ORDER BY \""+order+"\" DESC LIMIT 500").query().listOfRows():jdbc.sql("SELECT * FROM \""+table+"\" WHERE \"tenantId\"=:tenant ORDER BY \""+order+"\" DESC LIMIT 500").param("tenant",p.tenantId()).query().listOfRows();}
  private Map<String,Object> page(java.util.List<Map<String,Object>> rows){return Map.of("items",rows,"total",rows.size(),"page",1,"pageSize",rows.size());}private PlatformPrincipal p(Authentication auth){return(PlatformPrincipal)auth.getPrincipal();}
  public record UserRequest(String email,String displayName,String role,UUID tenantId,String temporaryPassword){}public record TemplateRequest(UUID projectId,String name,String description,String definitionJson){}public record PushRequest(String token,String platform){}
}
