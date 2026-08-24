package com.robothygenism.platform.safety;

import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.tenancy.ScopeService;
import java.util.Map;import java.util.UUID;
import org.springframework.http.HttpStatus;import org.springframework.jdbc.core.simple.JdbcClient;import org.springframework.security.core.Authentication;import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/faults") public class FaultController{
 private final JdbcClient jdbc;private final ScopeService scope;private final PermissionService permissions;private final SafePolicyService policies;public FaultController(JdbcClient j,ScopeService s,PermissionService p,SafePolicyService policies){jdbc=j;scope=s;permissions=p;this.policies=policies;}
 @GetMapping public Map<String,Object> list(Authentication a){var p=p(a);var spec=p.superAdmin()?jdbc.sql(sql()+" ORDER BY f.\"startAt\" DESC"):p.role().equals("TENANT_ADMIN")?jdbc.sql(sql()+" WHERE f.\"tenantId\"=:tenant ORDER BY f.\"startAt\" DESC").param("tenant",p.tenantId()):jdbc.sql(sql()+" WHERE f.\"projectId\" IN (SELECT \"projectId\" FROM \"UserProjectAccess\" WHERE \"userId\"=:user) ORDER BY f.\"startAt\" DESC").param("user",p.id());var rows=spec.query().listOfRows();return Map.of("items",rows,"total",rows.size(),"page",1,"pageSize",rows.size());}
 @GetMapping("/{id}") public Map<String,Object> get(@PathVariable UUID id,Authentication a){var row=jdbc.sql(sql()+" WHERE f.id=:id").param("id",id).query().listOfRows().stream().findFirst().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Fault not found"));scope.project(p(a),(UUID)row.get("projectId"));return Map.of("fault",row,"policy",policies.policy((String)row.get("safeCode")));}
 @PostMapping("/{id}/acknowledge") public Map<String,Object> ack(@PathVariable UUID id,@RequestBody(required=false)Map<String,Object> body,Authentication a){var p=p(a);permissions.require(p,"FAULT_ACKNOWLEDGE");get(id,a);String note=body==null||body.get("note")==null?"":String.valueOf(body.get("note")).trim();if(note.length()>1000)throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_HANDLING_NOTE","Handling note must not exceed 1000 characters");jdbc.sql("UPDATE \"FaultEvent\" SET \"handlingStatus\"='ACKNOWLEDGED',\"acknowledgedById\"=:user,\"acknowledgedAt\"=CURRENT_TIMESTAMP,\"handlingRemark\"=NULLIF(:note,'') WHERE id=:id").param("user",p.id()).param("note",note).param("id",id).update();return Map.of("id",id,"handlingStatus","ACKNOWLEDGED","safetyReset",false);}
 private String sql(){return "SELECT f.id,f.\"tenantId\",f.\"projectId\",f.\"robotId\",f.\"taskId\",f.\"safeCode\",f.source,f.severity::text severity,f.latched,f.\"fullBlock\",f.\"startAt\",f.\"endAt\",f.\"positionX\",f.\"positionY\",f.\"handlingStatus\"::text \"handlingStatus\",f.\"acknowledgedAt\",f.\"handledAt\",f.\"handlingRemark\" FROM \"FaultEvent\" f";}private PlatformPrincipal p(Authentication a){return(PlatformPrincipal)a.getPrincipal();}
}



