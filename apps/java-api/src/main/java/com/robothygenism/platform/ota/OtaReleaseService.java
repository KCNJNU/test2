package com.robothygenism.platform.ota;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.auth.PermissionService;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.storage.ObjectStoragePort;
import com.robothygenism.platform.tenancy.ScopeService;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class OtaReleaseService {
  private static final Set<String> COMPONENTS = Set.of("ROBOT_APPLICATION", "ROBOT_AGENT", "ROS_PACKAGE", "MCU_FIRMWARE");
  private static final Set<String> CATEGORIES = Set.of("BUSINESS", "CLEANING", "NAVIGATION", "SAFETY");
  private static final Set<String> STRATEGIES = Set.of("SINGLE", "SELECTED_BATCH", "PERCENTAGE", "PROJECT");
  private static final String SEMVER = "v?[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?";

  private final JdbcClient jdbc;
  private final ObjectMapper json;
  private final ObjectStoragePort storage;
  private final ArtifactVerifier artifacts;
  private final ConfigChecksumService configChecksums;
  private final OtaEligibilityPolicy eligibility;
  private final PermissionService permissions;
  private final ScopeService scope;
  private final boolean signatureRequired;
  private final String signaturePublicKey;
  private final int downloadTtlSeconds;
  private final int maximumSelectedBatch;

  public OtaReleaseService(
      JdbcClient jdbc,
      ObjectMapper json,
      ObjectStoragePort storage,
      ArtifactVerifier artifacts,
      ConfigChecksumService configChecksums,
      OtaEligibilityPolicy eligibility,
      PermissionService permissions,
      ScopeService scope,
      @Value("${OTA_SIGNATURE_REQUIRED:false}") boolean signatureRequired,
      @Value("${OTA_SIGNATURE_PUBLIC_KEY_BASE64:}") String signaturePublicKey,
      @Value("${OTA_DOWNLOAD_URL_TTL_SECONDS:900}") int downloadTtlSeconds,
      @Value("${OTA_MAX_SELECTED_BATCH:50}") int maximumSelectedBatch) {
    this.jdbc = jdbc; this.json = json; this.storage = storage; this.artifacts = artifacts; this.configChecksums = configChecksums;
    this.eligibility = eligibility; this.permissions = permissions; this.scope = scope; this.signatureRequired = signatureRequired;
    this.signaturePublicKey = signaturePublicKey; this.downloadTtlSeconds = downloadTtlSeconds; this.maximumSelectedBatch = maximumSelectedBatch;
  }

  @Transactional
  public Map<String, Object> registerSoftware(SoftwareUpload request, MultipartFile file, PlatformPrincipal actor) {
    permissions.require(actor, "OTA_MANAGE");
    require(COMPONENTS.contains(request.component()), "SOFTWARE_COMPONENT_INVALID", "Software component is invalid");
    require(request.version() != null && request.version().matches(SEMVER), "SOFTWARE_VERSION_INVALID", "Software version must be SemVer");
    require(file != null && !file.isEmpty(), "ARTIFACT_REQUIRED", "Artifact file is required");
    require(request.minimumBatteryPercent() >= 1 && request.minimumBatteryPercent() <= 100, "BATTERY_POLICY_INVALID", "Minimum battery must be between 1 and 100");
    String actual;
    try { actual = artifacts.sha256(file.getInputStream()); }
    catch (Exception error) { throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ARTIFACT_READ_FAILED", "Unable to read artifact"); }
    artifacts.requireChecksum(request.checksum(), actual);
    verifySignature(actual, request.signature());
    var fileName = safeFileName(file.getOriginalFilename());
    var objectKey = "ota/" + request.component().toLowerCase().replace('_', '-') + "/" + request.version() + "/" + UUID.randomUUID() + "-" + fileName;
    try (InputStream content = file.getInputStream()) {
      storage.put(objectKey, content, file.getSize(), file.getContentType() == null ? "application/octet-stream" : file.getContentType());
    } catch (Exception error) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ARTIFACT_STORAGE_FAILED", "Artifact storage failed");
    }
    UUID id = UUID.randomUUID();
    try {
      jdbc.sql("INSERT INTO \"SoftwareVersion\" (id,component,version,\"objectKey\",\"mimeType\",\"fileSize\",checksum,signature,\"signatureAlgorithm\",status,compatibility,\"hardwareModels\",\"minBatteryPercent\",\"releaseNotes\",\"createdById\",\"verifiedAt\",\"createdAt\") VALUES (:id,CAST(:component AS \"SoftwareComponent\"),:version,:objectKey,:mime,:size,:checksum,:signature,:algorithm,'VERIFIED',CAST(:compatibility AS jsonb),:hardware,:battery,:notes,:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
          .param("id", id).param("component", request.component()).param("version", request.version()).param("objectKey", objectKey)
          .param("mime", file.getContentType() == null ? "application/octet-stream" : file.getContentType()).param("size", file.getSize())
          .param("checksum", actual).param("signature", blankToNull(request.signature())).param("algorithm", blankToNull(request.signature()) == null ? null : "Ed25519")
          .param("compatibility", write(request.compatibility() == null ? Map.of() : request.compatibility())).param("hardware", request.hardwareModels().toArray(String[]::new))
          .param("battery", request.minimumBatteryPercent()).param("notes", blankToNull(request.releaseNotes())).param("actor", actor.id()).update();
    } catch (DuplicateKeyException error) {
      storage.delete(objectKey);
      throw new ApiException(HttpStatus.CONFLICT, "SOFTWARE_VERSION_EXISTS", "Software component and version already exist");
    } catch (RuntimeException error) {
      storage.delete(objectKey);
      throw error;
    }
    return software(id);
  }

  public Map<String, Object> software(UUID id) {
    return jdbc.sql("SELECT id,component::text component,version,\"mimeType\",\"fileSize\",checksum,(signature IS NOT NULL) signed,status::text status,compatibility,\"hardwareModels\",\"minBatteryPercent\",\"releaseNotes\",\"verifiedAt\",\"createdAt\" FROM \"SoftwareVersion\" WHERE id=:id")
        .param("id", id).query().listOfRows().stream().findFirst().orElseThrow(() -> notFound("Software version"));
  }

  public Map<String, Object> softwareVersions() {
    return page(jdbc.sql("SELECT id,component::text component,version,\"mimeType\",\"fileSize\",checksum,(signature IS NOT NULL) signed,status::text status,compatibility,\"hardwareModels\",\"minBatteryPercent\",\"releaseNotes\",\"verifiedAt\",\"createdAt\" FROM \"SoftwareVersion\" ORDER BY \"createdAt\" DESC LIMIT 500").query().listOfRows());
  }

  public Map<String, Object> softwareDownload(UUID id, PlatformPrincipal actor) {
    permissions.require(actor, "OTA_MANAGE");
    var row = jdbc.sql("SELECT \"objectKey\",checksum,status::text status FROM \"SoftwareVersion\" WHERE id=:id").param("id", id).query().listOfRows().stream().findFirst().orElseThrow(() -> notFound("Software version"));
    require("VERIFIED".equals(row.get("status")), "ARTIFACT_NOT_RELEASEABLE", "Software artifact is not releaseable");
    verifyStoredArtifact((String) row.get("objectKey"), (String) row.get("checksum"), null);
    return Map.of("url", storage.presignedGet((String) row.get("objectKey"), downloadTtlSeconds), "expiresIn", downloadTtlSeconds, "checksum", row.get("checksum"));
  }

  @Transactional
  public Map<String, Object> createConfig(ConfigRequest request, PlatformPrincipal actor) {
    require(CATEGORIES.contains(request.category()), "CONFIG_CATEGORY_INVALID", "Configuration category is invalid");
    permissions.require(actor, "SAFETY".equals(request.category()) ? "CONFIG_SAFETY_MANAGE" : "OTA_MANAGE");
    require(request.version() != null && request.version().matches(SEMVER), "CONFIG_VERSION_INVALID", "Configuration version must be SemVer");
    require(request.content() != null && request.content().isObject(), "CONFIG_CONTENT_INVALID", "Configuration content must be an object");
    requireText(request.reason(), "CONFIG_REASON_REQUIRED", "Configuration reason is required");
    if (request.projectId() != null) scope.project(actor, request.projectId());
    UUID tenant = scope.tenant(actor, request.tenantId());
    if (request.projectId() != null) {
      UUID projectTenant = jdbc.sql("SELECT \"tenantId\" FROM \"Project\" WHERE id=:id").param("id", request.projectId()).query(UUID.class).single();
      require(tenant.equals(projectTenant), "CONFIG_SCOPE_INVALID", "Configuration project does not belong to the tenant");
    }
    if (request.rollbackVersionId() != null) {
      boolean valid = jdbc.sql("SELECT EXISTS(SELECT 1 FROM \"ConfigVersion\" WHERE id=:id AND \"tenantId\"=:tenant AND category=CAST(:category AS \"ConfigCategory\") AND \"approvalStatus\"='APPROVED')")
          .param("id", request.rollbackVersionId()).param("tenant", tenant).param("category", request.category()).query(Boolean.class).single();
      require(valid, "ROLLBACK_VERSION_INVALID", "Rollback configuration must be an approved version in the same category");
    }
    String checksum = configChecksums.checksum(request.content());
    UUID id = UUID.randomUUID();
    String approval = "SAFETY".equals(request.category()) ? "PENDING_APPROVAL" : "APPROVED";
    try {
      jdbc.sql("INSERT INTO \"ConfigVersion\" (id,\"tenantId\",\"projectId\",category,version,checksum,content,reason,\"approvalStatus\",\"createdById\",\"approvedById\",\"approvedAt\",\"rollbackVersionId\",\"createdAt\") VALUES (:id,:tenant,:project,CAST(:category AS \"ConfigCategory\"),:version,:checksum,CAST(:content AS jsonb),:reason,CAST(:approval AS \"ConfigApprovalStatus\"),:actor,:approver,CASE WHEN :approval='APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END,:rollback,CURRENT_TIMESTAMP)")
          .param("id", id).param("tenant", tenant).param("project", request.projectId()).param("category", request.category()).param("version", request.version())
          .param("checksum", checksum).param("content", write(request.content())).param("reason", request.reason()).param("approval", approval).param("actor", actor.id())
          .param("approver", "APPROVED".equals(approval) ? actor.id() : null).param("rollback", request.rollbackVersionId()).update();
    } catch (DuplicateKeyException error) { throw new ApiException(HttpStatus.CONFLICT, "CONFIG_VERSION_EXISTS", "Configuration category and version already exist"); }
    return config(id, actor);
  }

  @Transactional
  public Map<String, Object> decideConfig(UUID id, ApprovalRequest request, PlatformPrincipal actor) {
    permissions.require(actor, "CONFIG_SAFETY_MANAGE"); requireText(request.reason(), "APPROVAL_REASON_REQUIRED", "Approval reason is required");
    require(Set.of("APPROVED", "REJECTED").contains(request.decision()), "APPROVAL_DECISION_INVALID", "Approval decision is invalid");
    var row = scopedConfig(id, actor);
    require("SAFETY".equals(row.get("category")), "CONFIG_APPROVAL_NOT_REQUIRED", "Only L4 Safety configuration requires approval");
    require("PENDING_APPROVAL".equals(row.get("approvalStatus")), "CONFIG_ALREADY_DECIDED", "Configuration approval has already been decided");
    require(!actor.id().equals(row.get("createdById")), "CONFIG_SELF_APPROVAL_FORBIDDEN", "Safety configuration requires a different approver");
    jdbc.sql("INSERT INTO \"ConfigApproval\" (id,\"configVersionId\",\"approverId\",decision,reason,\"createdAt\") VALUES (:id,:config,:actor,CAST(:decision AS \"ConfigApprovalDecision\"),:reason,CURRENT_TIMESTAMP)")
        .param("id", UUID.randomUUID()).param("config", id).param("actor", actor.id()).param("decision", request.decision()).param("reason", request.reason()).update();
    jdbc.sql("UPDATE \"ConfigVersion\" SET \"approvalStatus\"=CAST(:decision AS \"ConfigApprovalStatus\"),\"approvedById\"=CASE WHEN :decision='APPROVED' THEN :actor ELSE NULL END,\"approvedAt\"=CASE WHEN :decision='APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=:id")
        .param("decision", request.decision()).param("actor", actor.id()).param("id", id).update();
    return config(id, actor);
  }

  public Map<String, Object> config(UUID id, PlatformPrincipal actor) { return scopedConfig(id, actor); }

  public Map<String, Object> configVersions(PlatformPrincipal actor) {
    var rows = actor.superAdmin()
        ? jdbc.sql("SELECT id,\"tenantId\",\"projectId\",category::text category,version,checksum,content,reason,\"approvalStatus\"::text \"approvalStatus\",\"createdById\",\"approvedById\",\"approvedAt\",\"rollbackVersionId\",\"createdAt\" FROM \"ConfigVersion\" ORDER BY \"createdAt\" DESC LIMIT 500").query().listOfRows()
        : jdbc.sql("SELECT id,\"tenantId\",\"projectId\",category::text category,version,checksum,content,reason,\"approvalStatus\"::text \"approvalStatus\",\"createdById\",\"approvedById\",\"approvedAt\",\"rollbackVersionId\",\"createdAt\" FROM \"ConfigVersion\" WHERE \"tenantId\"=:tenant ORDER BY \"createdAt\" DESC LIMIT 500").param("tenant", actor.tenantId()).query().listOfRows();
    return page(rows);
  }

  @Transactional
  public Map<String, Object> createCampaign(CampaignRequest request, PlatformPrincipal actor) {
    permissions.require(actor, "OTA_MANAGE"); scope.project(actor, request.projectId()); requireText(request.reason(), "OTA_REASON_REQUIRED", "OTA release reason is required");
    require(STRATEGIES.contains(request.strategy()), "ROLLOUT_STRATEGY_INVALID", "Rollout strategy is invalid");
    require((request.softwareVersionId() == null) != (request.configVersionId() == null), "OTA_TARGET_INVALID", "Exactly one software or configuration version is required");
    Target target = target(request, actor);
    if (target.safetyConfig()) permissions.require(actor, "CONFIG_SAFETY_MANAGE");
    var candidates = selectCandidates(request, target);
    var eligible = new ArrayList<OtaEligibilityPolicy.RobotCandidate>();
    var blocked = new ArrayList<Map<String, Object>>();
    for (var robot : candidates) {
      var reasons = eligibility.violations(robot, target.minimumBattery(), target.hardwareModels(), target.version());
      if (reasons.isEmpty()) eligible.add(robot); else blocked.add(Map.of("robotId", robot.id(), "reasons", reasons));
    }
    if (Set.of("SINGLE", "SELECTED_BATCH").contains(request.strategy()) && !blocked.isEmpty()) {
      throw new ApiException(HttpStatus.CONFLICT, "OTA_PRECONDITION_FAILED", "One or more selected robots are not eligible", Map.of("blockedTargets", blocked));
    }
    require(!eligible.isEmpty(), "OTA_NO_ELIGIBLE_TARGETS", "No robot is eligible for this release");
    UUID campaignId = UUID.randomUUID();
    UUID tenant = jdbc.sql("SELECT \"tenantId\" FROM \"Project\" WHERE id=:id").param("id", request.projectId()).query(UUID.class).single();
    jdbc.sql("INSERT INTO \"OtaCampaign\" (id,\"tenantId\",\"projectId\",\"softwareVersionId\",\"configVersionId\",strategy,percentage,\"requestedRobotIds\",status,reason,\"createdById\",\"targetCount\",\"eligibleCount\",\"blockedCount\",\"blockedTargets\",\"startedAt\",\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:software,:config,CAST(:strategy AS \"OtaRolloutStrategy\"),:percentage,:requested,'RUNNING',:reason,:actor,:targetCount,:eligibleCount,:blockedCount,CAST(:blocked AS jsonb),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .param("id", campaignId).param("tenant", tenant).param("project", request.projectId()).param("software", request.softwareVersionId()).param("config", request.configVersionId())
        .param("strategy", request.strategy()).param("percentage", request.percentage()).param("requested", request.robotIds().toArray(UUID[]::new)).param("reason", request.reason())
        .param("actor", actor.id()).param("targetCount", candidates.size()).param("eligibleCount", eligible.size()).param("blockedCount", blocked.size()).param("blocked", write(blocked)).update();
    for (var robot : eligible) createJobAndCommand(campaignId, tenant, request.projectId(), robot, target, request.reason(), actor);
    return campaign(campaignId, actor);
  }

  public Map<String, Object> campaigns(PlatformPrincipal actor) {
    var rows = actor.superAdmin()
        ? jdbc.sql("SELECT id,\"tenantId\",\"projectId\",\"softwareVersionId\",\"configVersionId\",strategy::text strategy,percentage,status::text status,reason,\"targetCount\",\"eligibleCount\",\"blockedCount\",\"startedAt\",\"finishedAt\",\"createdAt\" FROM \"OtaCampaign\" ORDER BY \"createdAt\" DESC LIMIT 500").query().listOfRows()
        : jdbc.sql("SELECT id,\"tenantId\",\"projectId\",\"softwareVersionId\",\"configVersionId\",strategy::text strategy,percentage,status::text status,reason,\"targetCount\",\"eligibleCount\",\"blockedCount\",\"startedAt\",\"finishedAt\",\"createdAt\" FROM \"OtaCampaign\" WHERE \"tenantId\"=:tenant ORDER BY \"createdAt\" DESC LIMIT 500").param("tenant", actor.tenantId()).query().listOfRows();
    return page(rows);
  }

  public Map<String, Object> campaign(UUID id, PlatformPrincipal actor) {
    var row = actor.superAdmin()
        ? jdbc.sql("SELECT * FROM \"OtaCampaign\" WHERE id=:id").param("id", id).query().listOfRows().stream().findFirst()
        : jdbc.sql("SELECT * FROM \"OtaCampaign\" WHERE id=:id AND \"tenantId\"=:tenant").param("id", id).param("tenant", actor.tenantId()).query().listOfRows().stream().findFirst();
    var campaign = row.orElseThrow(() -> notFound("OTA campaign"));
    var result = new LinkedHashMap<String, Object>(campaign);
    result.put("jobs", jdbc.sql("SELECT j.*,r.name \"robotName\",r.\"externalId\" \"robotSn\" FROM \"OTAJob\" j JOIN \"Robot\" r ON r.id=j.\"robotId\" WHERE j.\"campaignId\"=:campaign ORDER BY j.\"createdAt\"").param("campaign", id).query().listOfRows());
    return result;
  }

  public Map<String, Object> otaJobs(PlatformPrincipal actor) {
    var rows = actor.superAdmin() ? jdbc.sql("SELECT * FROM \"OTAJob\" ORDER BY \"createdAt\" DESC LIMIT 500").query().listOfRows()
        : jdbc.sql("SELECT * FROM \"OTAJob\" WHERE \"tenantId\"=:tenant ORDER BY \"createdAt\" DESC LIMIT 500").param("tenant", actor.tenantId()).query().listOfRows();
    return page(rows);
  }

  private Target target(CampaignRequest request, PlatformPrincipal actor) {
    if (request.softwareVersionId() != null) {
      var row = jdbc.sql("SELECT id,component::text component,version,\"objectKey\",\"fileSize\",checksum,signature,\"signatureAlgorithm\",status::text status,\"hardwareModels\",\"minBatteryPercent\" FROM \"SoftwareVersion\" WHERE id=:id").param("id", request.softwareVersionId()).query().listOfRows().stream().findFirst().orElseThrow(() -> notFound("Software version"));
      require("VERIFIED".equals(row.get("status")), "ARTIFACT_NOT_RELEASEABLE", "Software artifact is not verified");
      verifyStoredArtifact((String) row.get("objectKey"), (String) row.get("checksum"), ((Number) row.get("fileSize")).longValue());
      String component = (String) row.get("component");
      var payload = new LinkedHashMap<String, Object>();
      payload.put("component", component); payload.put("version", row.get("version")); payload.put("downloadUrl", storage.presignedGet((String) row.get("objectKey"), downloadTtlSeconds));
      payload.put("checksum", row.get("checksum")); payload.put("fileSize", row.get("fileSize")); payload.put("signature", row.get("signature")); payload.put("signatureAlgorithm", row.get("signatureAlgorithm"));
      return new Target(false, false, request.softwareVersionId(), (String) row.get("version"), (String) row.get("checksum"), ((Number) row.get("minBatteryPercent")).intValue(), strings(row.get("hardwareModels")), "SOFTWARE_UPDATE", component, payload);
    }
    var row = scopedConfig(request.configVersionId(), actor);
    require("APPROVED".equals(row.get("approvalStatus")), "CONFIG_NOT_APPROVED", "Configuration version is not approved");
    JsonNode content = readNode(row.get("content"));
    artifacts.requireChecksum((String) row.get("checksum"), configChecksums.checksum(content));
    var payload = new LinkedHashMap<String, Object>(); payload.put("category", row.get("category")); payload.put("version", row.get("version")); payload.put("content", content); payload.put("checksum", row.get("checksum")); payload.put("rollbackVersionId", row.get("rollbackVersionId"));
    return new Target(true, "SAFETY".equals(row.get("category")), request.configVersionId(), (String) row.get("version"), (String) row.get("checksum"), 30, List.of(), "CONFIG_APPLY", "CONFIG", payload);
  }

  private List<OtaEligibilityPolicy.RobotCandidate> selectCandidates(CampaignRequest request, Target target) {
    var all = jdbc.sql("SELECT r.id,r.\"onlineStatus\"::text online,r.\"operationalState\"::text state,r.\"batteryPercent\",r.metadata->>'hardwareModel' \"hardwareModel\",CASE WHEN :component='MCU_FIRMWARE' THEN r.\"mcuVersion\" WHEN :component='CONFIG' THEN r.\"configVersion\" ELSE r.\"softwareVersion\" END \"currentVersion\",EXISTS(SELECT 1 FROM \"MaintenanceRecord\" m WHERE m.\"robotId\"=r.id AND m.\"exitedAt\" IS NULL) maintenance FROM \"Robot\" r WHERE r.\"projectId\"=:project AND r.\"lifecycleStatus\"='ACTIVE' ORDER BY r.id")
        .param("component", target.component()).param("project", request.projectId()).query().listOfRows().stream().map(this::candidate).toList();
    var ids = request.robotIds() == null ? List.<UUID>of() : request.robotIds().stream().distinct().toList();
    if ("SINGLE".equals(request.strategy())) require(ids.size() == 1, "SINGLE_ROBOT_REQUIRED", "Single rollout requires exactly one robot");
    if ("SELECTED_BATCH".equals(request.strategy())) require(!ids.isEmpty() && ids.size() <= maximumSelectedBatch, "BATCH_SIZE_INVALID", "Selected batch size is invalid");
    if (Set.of("SINGLE", "SELECTED_BATCH").contains(request.strategy())) {
      var selected = all.stream().filter(robot -> ids.contains(robot.id())).toList();
      require(selected.size() == ids.size(), "ROBOT_SCOPE_INVALID", "One or more robots are outside the project");
      return selected;
    }
    require(ids.isEmpty(), "ROBOT_IDS_NOT_ALLOWED", "Robot IDs are only valid for single or selected batch rollout");
    if ("PERCENTAGE".equals(request.strategy())) {
      require(request.percentage() != null && request.percentage() >= 1 && request.percentage() <= 99, "ROLLOUT_PERCENTAGE_INVALID", "Percentage rollout must be between 1 and 99");
      int count = Math.max(1, (int) Math.ceil(all.size() * request.percentage() / 100.0));
      return all.stream().sorted(Comparator.comparing(robot -> robot.id().toString())).limit(count).toList();
    }
    require(Boolean.TRUE.equals(request.confirmProjectRollout()), "PROJECT_ROLLOUT_CONFIRMATION_REQUIRED", "Project rollout requires explicit confirmation");
    boolean canary = jdbc.sql("SELECT EXISTS(SELECT 1 FROM \"OtaCampaign\" c JOIN \"OTAJob\" j ON j.\"campaignId\"=c.id WHERE c.\"projectId\"=:project AND c.strategy IN ('SINGLE','SELECTED_BATCH') AND j.status='SUCCEEDED' AND ((:software IS NOT NULL AND c.\"softwareVersionId\"=:software) OR (:config IS NOT NULL AND c.\"configVersionId\"=:config)))")
        .param("project", request.projectId()).param("software", request.softwareVersionId()).param("config", request.configVersionId()).query(Boolean.class).single();
    require(canary, "CANARY_REQUIRED", "A successful single-robot or selected-batch canary is required before project rollout");
    return all;
  }

  private void createJobAndCommand(UUID campaignId, UUID tenant, UUID project, OtaEligibilityPolicy.RobotCandidate robot, Target target, String reason, PlatformPrincipal actor) {
    UUID jobId = UUID.randomUUID(), commandId = UUID.randomUUID();
    var commandPayload = new LinkedHashMap<String, Object>(target.payload()); commandPayload.put("otaJobId", jobId); commandPayload.put("campaignId", campaignId); commandPayload.put("previousVersion", robot.currentVersion());
    jdbc.sql("INSERT INTO \"OTAJob\" (id,\"tenantId\",\"projectId\",\"robotId\",\"softwareVersionId\",\"configVersionId\",\"campaignId\",\"commandId\",status,progress,\"targetChecksum\",\"previousVersion\",\"rollbackVersion\",reason,\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:robot,:software,:config,:campaign,:command,'PENDING',0,:checksum,:previous,:previous,:reason,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .param("id", jobId).param("tenant", tenant).param("project", project).param("robot", robot.id()).param("software", target.config() ? null : target.id()).param("config", target.config() ? target.id() : null)
        .param("campaign", campaignId).param("command", commandId).param("checksum", target.checksum()).param("previous", robot.currentVersion()).param("reason", reason).update();
    jdbc.sql("INSERT INTO \"OTAEvent\" (id,\"otaJobId\",status,progress,source,\"occurredAt\",\"receivedAt\") VALUES (:id,:job,'PENDING',0,'PLATFORM',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .param("id", UUID.randomUUID()).param("job", jobId).update();
    jdbc.sql("INSERT INTO \"Command\" (id,\"robotId\",type,payload,status,\"idempotencyKey\",\"createdById\",\"createdAt\",\"updatedAt\") VALUES (:id,:robot,CAST(:type AS \"CommandType\"),CAST(:payload AS jsonb),'CREATED',:key,:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .param("id", commandId).param("robot", robot.id()).param("type", target.commandType()).param("payload", write(commandPayload)).param("key", "ota:" + campaignId + ":" + robot.id()).param("actor", actor.id()).update();
    var envelope = Map.of("schemaVersion", "1.0", "messageId", "OTA-" + UUID.randomUUID(), "commandId", commandId, "robotId", robot.id(), "type", target.commandType(), "timestamp", System.currentTimeMillis(), "payload", commandPayload);
    jdbc.sql("INSERT INTO \"OutboxMessage\" (id,\"aggregateType\",\"aggregateId\",topic,payload,\"availableAt\",\"createdAt\") VALUES (:id,'Command',:aggregate,:topic,CAST(:payload AS jsonb),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .param("id", UUID.randomUUID()).param("aggregate", commandId.toString()).param("topic", "robots/" + robot.id() + "/commands").param("payload", write(envelope)).update();
  }

  private Map<String, Object> scopedConfig(UUID id, PlatformPrincipal actor) {
    var query = actor.superAdmin()
        ? jdbc.sql("SELECT id,\"tenantId\",\"projectId\",category::text category,version,checksum,content,reason,\"approvalStatus\"::text \"approvalStatus\",\"createdById\",\"approvedById\",\"approvedAt\",\"rollbackVersionId\",\"createdAt\" FROM \"ConfigVersion\" WHERE id=:id").param("id", id)
        : jdbc.sql("SELECT id,\"tenantId\",\"projectId\",category::text category,version,checksum,content,reason,\"approvalStatus\"::text \"approvalStatus\",\"createdById\",\"approvedById\",\"approvedAt\",\"rollbackVersionId\",\"createdAt\" FROM \"ConfigVersion\" WHERE id=:id AND \"tenantId\"=:tenant").param("id", id).param("tenant", actor.tenantId());
    return query.query().listOfRows().stream().findFirst().orElseThrow(() -> notFound("Configuration version"));
  }

  private void verifyStoredArtifact(String objectKey, String checksum, Long expectedSize) {
    require(storage.exists(objectKey), "ARTIFACT_MISSING", "Software artifact is missing from object storage");
    if (expectedSize != null) require(storage.size(objectKey) == expectedSize, "ARTIFACT_SIZE_MISMATCH", "Stored artifact size does not match release metadata");
    artifacts.requireChecksum(checksum, artifacts.sha256(storage.get(objectKey)));
  }

  private void verifySignature(String checksum, String signature) {
    if (signatureRequired) {
      requireText(signature, "SIGNATURE_REQUIRED", "A trusted artifact signature is required");
      requireText(signaturePublicKey, "SIGNATURE_TRUST_NOT_CONFIGURED", "Artifact signature trust is not configured");
    }
    if (blankToNull(signature) != null) {
      requireText(signaturePublicKey, "SIGNATURE_TRUST_NOT_CONFIGURED", "Artifact signature trust is not configured");
      artifacts.verifyEd25519(checksum, signature, signaturePublicKey);
    }
  }

  private OtaEligibilityPolicy.RobotCandidate candidate(Map<String, Object> row) {
    return new OtaEligibilityPolicy.RobotCandidate((UUID) row.get("id"), (String) row.get("online"), (String) row.get("state"), (Integer) row.get("batteryPercent"), (String) row.get("hardwareModel"), (String) row.get("currentVersion"), Boolean.TRUE.equals(row.get("maintenance")));
  }

  private List<String> strings(Object value) {
    if (value instanceof String[] values) return List.of(values);
    if (value instanceof java.sql.Array array) try { return List.of((String[]) array.getArray()); } catch (Exception ignored) { return List.of(); }
    return List.of();
  }

  private JsonNode readNode(Object value) { try { return value instanceof JsonNode node ? node : json.readTree(String.valueOf(value)); } catch (Exception error) { throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "CONFIG_CONTENT_INVALID", "Stored configuration is invalid"); } }
  private String write(Object value) { try { return json.writeValueAsString(value); } catch (Exception error) { throw new IllegalArgumentException("Value is not JSON serializable", error); } }
  private String safeFileName(String name) { var safe = name == null ? "artifact.bin" : name.replaceAll("[^A-Za-z0-9._-]", "-"); return safe.isBlank() ? "artifact.bin" : safe.substring(0, Math.min(safe.length(), 120)); }
  private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
  private void requireText(String value, String code, String message) { require(value != null && !value.isBlank(), code, message); }
  private void require(boolean condition, String code, String message) { if (!condition) throw new ApiException(HttpStatus.CONFLICT, code, message); }
  private ApiException notFound(String resource) { return new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", resource + " not found"); }
  private Map<String, Object> page(List<Map<String, Object>> rows) { return Map.of("items", rows, "total", rows.size(), "page", 1, "pageSize", rows.size()); }

  public record SoftwareUpload(String component, String version, String checksum, String signature, Map<String, Object> compatibility, List<String> hardwareModels, int minimumBatteryPercent, String releaseNotes) {
    public SoftwareUpload { hardwareModels = hardwareModels == null ? List.of() : hardwareModels.stream().filter(value -> value != null && !value.isBlank()).distinct().toList(); if (minimumBatteryPercent == 0) minimumBatteryPercent = 30; }
  }
  public record ConfigRequest(UUID tenantId, UUID projectId, String category, String version, JsonNode content, String reason, UUID rollbackVersionId) {}
  public record ApprovalRequest(String decision, String reason) {}
  public record CampaignRequest(UUID projectId, UUID softwareVersionId, UUID configVersionId, String strategy, List<UUID> robotIds, Integer percentage, Boolean confirmProjectRollout, String reason) {
    public CampaignRequest { robotIds = robotIds == null ? List.of() : List.copyOf(robotIds); }
  }
  private record Target(boolean config, boolean safetyConfig, UUID id, String version, String checksum, int minimumBattery, List<String> hardwareModels, String commandType, String component, Map<String, Object> payload) {}
}
