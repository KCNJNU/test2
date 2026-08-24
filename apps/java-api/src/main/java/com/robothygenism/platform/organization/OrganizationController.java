package com.robothygenism.platform.organization;

import com.robothygenism.platform.audit.AuditService;
import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.tenancy.ScopeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class OrganizationController {
  private final JdbcClient jdbc; private final ScopeService scope; private final PermissionService permissions; private final AuditService audit;
  public OrganizationController(JdbcClient jdbc, ScopeService scope, PermissionService permissions, AuditService audit) { this.jdbc=jdbc; this.scope=scope; this.permissions=permissions; this.audit=audit; }

  @GetMapping("/tenants") public Map<String,Object> tenants(Authentication auth) { var p=principal(auth); var rows=p.superAdmin()?jdbc.sql("SELECT id,code,name,status::text status,\"createdAt\",\"updatedAt\" FROM \"Tenant\" ORDER BY name").query().listOfRows():jdbc.sql("SELECT id,code,name,status::text status,\"createdAt\",\"updatedAt\" FROM \"Tenant\" WHERE id=:id").param("id",p.tenantId()).query().listOfRows(); return page(rows); }
  @PostMapping("/tenants") @Transactional public Map<String,Object> createTenant(@Valid @RequestBody Named request, Authentication auth, HttpServletRequest http) { var p=principal(auth); permissions.require(p,"TENANT_MANAGE"); UUID id=UUID.randomUUID(); jdbc.sql("INSERT INTO \"Tenant\" (id,code,name,status,\"createdAt\",\"updatedAt\") VALUES (:id,:code,:name,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("code",request.code()).param("name",request.name()).update(); var result=Map.<String,Object>of("id",id,"code",request.code(),"name",request.name(),"status","ACTIVE"); audit.record(p,http,"TENANT_CREATE","Tenant",id,id,null,null,result); return result; }

  @GetMapping("/projects") public Map<String,Object> projects(Authentication auth) { var p=principal(auth); var spec=p.superAdmin()?jdbc.sql("SELECT id,\"tenantId\",code,name,status::text status FROM \"Project\" ORDER BY name"):p.role().equals("TENANT_ADMIN")?jdbc.sql("SELECT id,\"tenantId\",code,name,status::text status FROM \"Project\" WHERE \"tenantId\"=:tenant ORDER BY name").param("tenant",p.tenantId()):jdbc.sql("SELECT p.id,p.\"tenantId\",p.code,p.name,p.status::text status FROM \"Project\" p JOIN \"UserProjectAccess\" a ON a.\"projectId\"=p.id WHERE a.\"userId\"=:user ORDER BY p.name").param("user",p.id()); return page(spec.query().listOfRows()); }
  @PostMapping("/projects") @Transactional public Map<String,Object> createProject(@Valid @RequestBody ProjectRequest request, Authentication auth, HttpServletRequest http) { var p=principal(auth); permissions.require(p,"PROJECT_MANAGE"); UUID tenant=scope.tenant(p,request.tenantId()),id=UUID.randomUUID(); jdbc.sql("INSERT INTO \"Project\" (id,\"tenantId\",code,name,status,\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:code,:name,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("tenant",tenant).param("code",request.code()).param("name",request.name()).update(); var result=Map.<String,Object>of("id",id,"tenantId",tenant,"code",request.code(),"name",request.name(),"status","ACTIVE"); audit.record(p,http,"PROJECT_CREATE","Project",id,tenant,id,null,result); return result; }

  @GetMapping("/sites") public Map<String,Object> sites(@RequestParam(required=false) UUID projectId, Authentication auth) { var p=principal(auth); if(projectId!=null) scope.project(p,projectId); var rows=projectId!=null?jdbc.sql("SELECT id,\"tenantId\",\"projectId\",code,name,status::text status FROM \"Site\" WHERE \"projectId\"=:project ORDER BY name").param("project",projectId).query().listOfRows():visible("Site",p); return page(rows); }
  @PostMapping("/sites") @Transactional public Map<String,Object> createSite(@Valid @RequestBody ChildRequest request, Authentication auth, HttpServletRequest http) { var p=principal(auth); permissions.require(p,"PROJECT_MANAGE"); scope.project(p,request.projectId()); UUID tenant=tenantForProject(request.projectId()),id=UUID.randomUUID(); jdbc.sql("INSERT INTO \"Site\" (id,\"tenantId\",\"projectId\",code,name,status,\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:code,:name,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("tenant",tenant).param("project",request.projectId()).param("code",request.code()).param("name",request.name()).update(); var result=Map.<String,Object>of("id",id,"projectId",request.projectId(),"code",request.code(),"name",request.name()); audit.record(p,http,"SITE_CREATE","Site",id,tenant,request.projectId(),null,result); return result; }

  @GetMapping("/floors") public Map<String,Object> floors(@RequestParam(required=false) UUID projectId, Authentication auth) { var p=principal(auth); if(projectId!=null) scope.project(p,projectId); var rows=projectId!=null?jdbc.sql("SELECT id,\"tenantId\",\"projectId\",\"siteId\",code,name,level,status::text status FROM \"Floor\" WHERE \"projectId\"=:project ORDER BY level,name").param("project",projectId).query().listOfRows():visible("Floor",p); return page(rows); }
  @PostMapping("/floors") @Transactional public Map<String,Object> createFloor(@Valid @RequestBody FloorRequest request, Authentication auth, HttpServletRequest http) { var p=principal(auth); permissions.require(p,"PROJECT_MANAGE"); scope.project(p,request.projectId()); UUID tenant=tenantForProject(request.projectId()),id=UUID.randomUUID(); boolean siteMatches=jdbc.sql("SELECT EXISTS(SELECT 1 FROM \"Site\" WHERE id=:site AND \"projectId\"=:project)").param("site",request.siteId()).param("project",request.projectId()).query(Boolean.class).single(); if(!siteMatches) throw new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Site not found"); jdbc.sql("INSERT INTO \"Floor\" (id,\"tenantId\",\"projectId\",\"siteId\",code,name,level,status,\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:site,:code,:name,:level,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("tenant",tenant).param("project",request.projectId()).param("site",request.siteId()).param("code",request.code()).param("name",request.name()).param("level",request.level()).update(); var result=Map.<String,Object>of("id",id,"siteId",request.siteId(),"code",request.code(),"name",request.name()); audit.record(p,http,"FLOOR_CREATE","Floor",id,tenant,request.projectId(),null,result); return result; }

  @DeleteMapping("/{resource:tenants|projects|sites|floors}/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deactivate(@PathVariable String resource,@PathVariable UUID id,Authentication auth,HttpServletRequest http){var p=principal(auth);permissions.require(p,resource.equals("tenants")?"TENANT_MANAGE":"PROJECT_MANAGE");String table=Map.of("tenants","Tenant","projects","Project","sites","Site","floors","Floor").get(resource);int changed=jdbc.sql("UPDATE \""+table+"\" SET status='INACTIVE',\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id AND status='ACTIVE'").param("id",id).update();if(changed==0)throw new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Resource not found");audit.record(p,http,table.toUpperCase()+"_DEACTIVATE",table,id,p.tenantId(),null,null,Map.of("status","INACTIVE"));}
  private java.util.List<Map<String,Object>> visible(String table,PlatformPrincipal p){if(p.superAdmin())return jdbc.sql("SELECT * FROM \""+table+"\" ORDER BY name").query().listOfRows();if(p.role().equals("TENANT_ADMIN"))return jdbc.sql("SELECT * FROM \""+table+"\" WHERE \"tenantId\"=:tenant ORDER BY name").param("tenant",p.tenantId()).query().listOfRows();return jdbc.sql("SELECT * FROM \""+table+"\" WHERE \"projectId\" IN (SELECT \"projectId\" FROM \"UserProjectAccess\" WHERE \"userId\"=:user) ORDER BY name").param("user",p.id()).query().listOfRows();}
  private UUID tenantForProject(UUID project){return jdbc.sql("SELECT \"tenantId\" FROM \"Project\" WHERE id=:id").param("id",project).query(UUID.class).optional().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Project not found"));}
  private PlatformPrincipal principal(Authentication auth){return (PlatformPrincipal)auth.getPrincipal();}
  private Map<String,Object> page(java.util.List<Map<String,Object>> rows){return Map.of("items",rows,"total",rows.size(),"page",1,"pageSize",rows.size());}
  public record Named(@NotBlank String code,@NotBlank String name){}
  public record ProjectRequest(UUID tenantId,@NotBlank String code,@NotBlank String name){}
  public record ChildRequest(UUID projectId,@NotBlank String code,@NotBlank String name){}
  public record FloorRequest(UUID projectId,UUID siteId,@NotBlank String code,@NotBlank String name,Integer level){}
}

