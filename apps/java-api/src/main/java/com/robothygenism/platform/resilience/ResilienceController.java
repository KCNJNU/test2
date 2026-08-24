package com.robothygenism.platform.resilience;

import com.robothygenism.platform.audit.AuditService;
import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class ResilienceController {
  private final ResilienceService resilience;private final PermissionService permissions;private final AuditService audit;
  public ResilienceController(ResilienceService resilience,PermissionService permissions,AuditService audit){this.resilience=resilience;this.permissions=permissions;this.audit=audit;}
  @GetMapping("/api/v1/system/resilience")public Map<String,Object> status(Authentication auth){permissions.require(p(auth),"RESILIENCE_MANAGE");return resilience.status();}
  @GetMapping("/api/v1/system/retention/preview")public Map<String,Object> preview(Authentication auth){permissions.require(p(auth),"RESILIENCE_MANAGE");return resilience.preview();}
  @PostMapping("/api/v1/system/retention/jobs")@ResponseStatus(HttpStatus.ACCEPTED)public Map<String,Object> retention(@Valid @RequestBody Retention request,Authentication auth,HttpServletRequest http){var principal=p(auth);permissions.require(principal,"RESILIENCE_MANAGE");var result=resilience.enqueue(principal,request.confirmation());audit.record(principal,http,"RETENTION_JOB_CREATED","Job",(java.util.UUID)result.get("jobId"),null,null,null,Map.of("policyVersion","D6-2026-08"));return result;}
  @PostMapping("/api/internal/v1/resilience/evidence")@ResponseStatus(HttpStatus.CREATED)public Map<String,Object> evidence(@RequestHeader(value="X-Resilience-Evidence-Token",required=false)String token,@Valid @RequestBody Evidence request){return resilience.record(token,new ResilienceService.Evidence(request.type(),request.status(),request.snapshotId(),request.sourceHost(),request.checksum(),request.objectCount(),request.totalBytes(),request.startedAt(),request.completedAt(),request.details()));}
  private PlatformPrincipal p(Authentication auth){return(PlatformPrincipal)auth.getPrincipal();}
  public record Retention(@NotBlank String confirmation){}
  public record Evidence(@NotNull ResilienceService.EvidenceType type,@NotNull ResilienceService.EvidenceStatus status,String snapshotId,String sourceHost,String checksum,Long objectCount,Long totalBytes,@NotNull OffsetDateTime startedAt,@NotNull OffsetDateTime completedAt,Map<String,Object> details){}
}
