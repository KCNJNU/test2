package com.robothygenism.platform.ota;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.audit.AuditService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class OtaReleaseController {
  private final OtaReleaseService releases;
  private final AuditService audit;
  private final ObjectMapper json;

  public OtaReleaseController(OtaReleaseService releases, AuditService audit, ObjectMapper json) { this.releases = releases; this.audit = audit; this.json = json; }

  @GetMapping("/software-versions") public Map<String, Object> softwareVersions() { return releases.softwareVersions(); }

  @PostMapping(value = "/software-versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, Object> registerSoftware(
      @RequestParam String component,
      @RequestParam String version,
      @RequestParam String checksum,
      @RequestParam(required = false) String signature,
      @RequestParam(required = false) String compatibility,
      @RequestParam(required = false) List<String> hardwareModels,
      @RequestParam(defaultValue = "30") int minimumBatteryPercent,
      @RequestParam(required = false) String releaseNotes,
      @RequestParam MultipartFile file,
      Authentication auth,
      HttpServletRequest http) {
    var actor = principal(auth);
    var result = releases.registerSoftware(new OtaReleaseService.SoftwareUpload(component, version, checksum, signature, objectMap(compatibility), hardwareModels, minimumBatteryPercent, releaseNotes), file, actor);
    audit.record(actor, http, "SOFTWARE_VERSION_REGISTER", "SoftwareVersion", (UUID) result.get("id"), actor.tenantId(), null, null, result);
    return result;
  }

  @GetMapping("/software-versions/{id}/download") public Map<String, Object> softwareDownload(@PathVariable UUID id, Authentication auth) { return releases.softwareDownload(id, principal(auth)); }
  @GetMapping("/config-versions") public Map<String, Object> configVersions(Authentication auth) { return releases.configVersions(principal(auth)); }

  @PostMapping("/config-versions")
  public Map<String, Object> createConfig(@RequestBody OtaReleaseService.ConfigRequest request, Authentication auth, HttpServletRequest http) {
    var actor = principal(auth); var result = releases.createConfig(request, actor);
    audit.record(actor, http, "CONFIG_VERSION_CREATE", "ConfigVersion", (UUID) result.get("id"), (UUID) result.get("tenantId"), (UUID) result.get("projectId"), null, result);
    return result;
  }

  @PostMapping("/config-versions/{id}/approval")
  public Map<String, Object> approveConfig(@PathVariable UUID id, @RequestBody OtaReleaseService.ApprovalRequest request, Authentication auth, HttpServletRequest http) {
    var actor = principal(auth); var before = releases.config(id, actor); var result = releases.decideConfig(id, request, actor);
    audit.record(actor, http, "CONFIG_SAFETY_APPROVAL", "ConfigVersion", id, (UUID) result.get("tenantId"), (UUID) result.get("projectId"), before, result);
    return result;
  }

  @GetMapping("/ota/campaigns") public Map<String, Object> campaigns(Authentication auth) { return releases.campaigns(principal(auth)); }
  @GetMapping("/ota/campaigns/{id}") public Map<String, Object> campaign(@PathVariable UUID id, Authentication auth) { return releases.campaign(id, principal(auth)); }

  @PostMapping("/ota/campaigns")
  public Map<String, Object> createCampaign(@RequestBody OtaReleaseService.CampaignRequest request, Authentication auth, HttpServletRequest http) {
    var actor = principal(auth); var result = releases.createCampaign(request, actor);
    audit.record(actor, http, "OTA_CAMPAIGN_CREATE", "OtaCampaign", (UUID) result.get("id"), (UUID) result.get("tenantId"), (UUID) result.get("projectId"), null, result);
    return result;
  }

  /** Backward-compatible job list used by the existing operations page. */
  @GetMapping("/ota") public Map<String, Object> otaJobs(Authentication auth) { return releases.otaJobs(principal(auth)); }

  /** Backward-compatible single-robot entry point; all new behavior uses a campaign. */
  @PostMapping("/ota")
  public Map<String, Object> legacySingle(@RequestBody LegacyOta request, Authentication auth, HttpServletRequest http) {
    return createCampaign(new OtaReleaseService.CampaignRequest(request.projectId(), request.softwareVersionId(), request.configVersionId(), "SINGLE", List.of(request.robotId()), null, false, request.reason()), auth, http);
  }

  private Map<String, Object> objectMap(String value) {
    if (value == null || value.isBlank()) return Map.of();
    try { return json.readValue(value, new TypeReference<>() {}); }
    catch (Exception error) { throw new ApiException(HttpStatus.BAD_REQUEST, "COMPATIBILITY_JSON_INVALID", "compatibility must be a JSON object"); }
  }
  private PlatformPrincipal principal(Authentication auth) { return (PlatformPrincipal) auth.getPrincipal(); }
  public record LegacyOta(UUID projectId, UUID robotId, UUID softwareVersionId, UUID configVersionId, String reason) {}
}
