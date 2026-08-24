package com.robothygenism.platform.task;

import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.tenancy.ScopeService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/tasks")
public class TaskController {
  private final TaskService tasks;private final JdbcClient jdbc;private final PermissionService permissions;private final ScopeService scope;
  public TaskController(TaskService tasks,JdbcClient jdbc,PermissionService permissions,ScopeService scope){this.tasks=tasks;this.jdbc=jdbc;this.permissions=permissions;this.scope=scope;}
  @GetMapping public Map<String,Object> list(Authentication auth){var p=p(auth);var spec=p.superAdmin()?jdbc.sql("SELECT id,\"projectId\",\"robotId\",name,status::text status,\"scheduledAt\",\"currentProgress\",\"lastStatusAt\" FROM \"Task\" ORDER BY \"createdAt\" DESC"):p.role().equals("TENANT_ADMIN")?jdbc.sql("SELECT id,\"projectId\",\"robotId\",name,status::text status,\"scheduledAt\",\"currentProgress\",\"lastStatusAt\" FROM \"Task\" WHERE \"tenantId\"=:tenant ORDER BY \"createdAt\" DESC").param("tenant",p.tenantId()):jdbc.sql("SELECT id,\"projectId\",\"robotId\",name,status::text status,\"scheduledAt\",\"currentProgress\",\"lastStatusAt\" FROM \"Task\" WHERE \"projectId\" IN (SELECT \"projectId\" FROM \"UserProjectAccess\" WHERE \"userId\"=:user) ORDER BY \"createdAt\" DESC").param("user",p.id());var rows=spec.query().listOfRows();return Map.of("items",rows,"total",rows.size(),"page",1,"pageSize",rows.size());}
  @PostMapping public Map<String,Object> create(@Valid @RequestBody TaskService.CreateTask request,Authentication auth){var p=p(auth);permissions.require(p,"TASK_CONTROL");scope.project(p,request.projectId());return tasks.create(request,p);}
  @GetMapping("/{id}") public Map<String,Object> get(@PathVariable UUID id,Authentication auth){var row=tasks.get(id);scope.project(p(auth),(UUID)row.get("projectId"));return row;}
  @PostMapping("/{id}/{action:start|pause|resume|cancel}") public Map<String,Object> action(@PathVariable UUID id,@PathVariable String action,@RequestHeader(value="Idempotency-Key",required=false)String key,Authentication auth){var p=p(auth);permissions.require(p,"TASK_CONTROL");var task=tasks.get(id);scope.project(p,(UUID)task.get("projectId"));return tasks.command(id,action,key,p);}
  private PlatformPrincipal p(Authentication auth){return (PlatformPrincipal)auth.getPrincipal();}
}

