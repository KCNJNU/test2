package com.robothygenism.platform.identity;

import com.robothygenism.platform.audit.AuditService;
import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/robots/{robotId}/device-certificates")
public class DeviceCertificateController {
  private final DeviceCertificateService certificates;private final PermissionService permissions;private final AuditService audit;
  public DeviceCertificateController(DeviceCertificateService certificates,PermissionService permissions,AuditService audit){this.certificates=certificates;this.permissions=permissions;this.audit=audit;}
  @GetMapping public Map<String,Object> list(@PathVariable UUID robotId,Authentication auth){var p=p(auth);permissions.require(p,"DEVICE_IDENTITY_MANAGE");var items=certificates.list(p,robotId);return Map.of("items",items,"total",items.size());}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> register(@PathVariable UUID robotId,@Valid @RequestBody Register request,Authentication auth,HttpServletRequest http){var p=p(auth);permissions.require(p,"DEVICE_IDENTITY_MANAGE");var result=certificates.register(p,robotId,request.certificatePem());audit.record(p,http,"DEVICE_CERTIFICATE_REGISTERED","DeviceCertificate",(UUID)result.get("id"),(UUID)result.get("tenantId"),null,null,Map.of("fingerprintSha256",result.get("fingerprintSha256")));return result;}
  @PostMapping("/{certificateId}/revoke") public Map<String,Object> revoke(@PathVariable UUID robotId,@PathVariable UUID certificateId,@Valid @RequestBody Revoke request,Authentication auth,HttpServletRequest http){var p=p(auth);permissions.require(p,"DEVICE_IDENTITY_MANAGE");var result=certificates.revoke(p,robotId,certificateId,request.reason());audit.record(p,http,"DEVICE_CERTIFICATE_REVOKED","DeviceCertificate",certificateId,p.tenantId(),null,null,Map.of("reason",request.reason()));return result;}
  private PlatformPrincipal p(Authentication auth){return(PlatformPrincipal)auth.getPrincipal();}
  public record Register(@NotBlank @Size(max=16384) String certificatePem){}
  public record Revoke(@NotBlank @Size(max=500) String reason){}
}
