package com.robothygenism.platform.resilience;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class ResilienceService {
  private final JdbcClient jdbc;private final ObjectMapper json;private final String evidenceToken;private final boolean retentionEnabled;private final long dbRpo;private final long objectRpo;private final int drillDays;
  public ResilienceService(JdbcClient jdbc,ObjectMapper json,@Value("${d6.resilience.evidence-token:}")String evidenceToken,@Value("${d6.resilience.retention-enabled:false}")boolean retentionEnabled,@Value("${d6.resilience.database-rpo-seconds:3600}")long dbRpo,@Value("${d6.resilience.object-rpo-seconds:21600}")long objectRpo,@Value("${d6.resilience.restore-drill-max-age-days:35}")int drillDays){this.jdbc=jdbc;this.json=json;this.evidenceToken=evidenceToken;this.retentionEnabled=retentionEnabled;this.dbRpo=dbRpo;this.objectRpo=objectRpo;this.drillDays=drillDays;}

  public Map<String,Object> status(){return Map.of("databaseBackup",latest("DATABASE_BACKUP",dbRpo),"objectBackup",latest("OBJECT_BACKUP",objectRpo),"restoreDrill",latest("RESTORE_DRILL",drillDays*86400L),"retention",Map.of("status",retentionEnabled?"healthy":"not_checked","message",retentionEnabled?"Retention execution is enabled":"Retention execution is disabled"));}
  public Map<String,Object> preview(){
    var counts=new LinkedHashMap<String,Object>();
    counts.put("auditLogs",count("SELECT count(*) FROM \"AuditLog\" WHERE \"createdAt\" < CURRENT_TIMESTAMP - INTERVAL '2 years'"));
    counts.put("faults",count("SELECT count(*) FROM \"FaultEvent\" WHERE \"createdAt\" < CURRENT_TIMESTAMP - INTERVAL '1 year'"));
    counts.put("tasks",count("SELECT count(*) FROM \"Task\" WHERE \"createdAt\" < CURRENT_TIMESTAMP - INTERVAL '1 year'"));
    counts.put("telemetry",count("SELECT count(*) FROM \"TelemetrySample\" WHERE \"receivedAt\" < CURRENT_TIMESTAMP - INTERVAL '30 days'"));
    counts.put("diagnostics",count("SELECT count(*) FROM \"DiagnosticBundle\" WHERE \"createdAt\" < CURRENT_TIMESTAMP - INTERVAL '90 days'"));
    return Map.of("generatedAt",OffsetDateTime.now(),"cutoffs",Map.of("auditDays",730,"faultTaskDays",365,"rawTelemetryDays",30,"telemetryAggregateDays",365,"applicationLogDays",90,"diagnosticDays",90),"candidates",counts,"executionEnabled",retentionEnabled);
  }
  public Map<String,Object> enqueue(PlatformPrincipal principal,String confirmation){
    if(!"APPLY_RETENTION_POLICY".equals(confirmation))throw new ApiException(HttpStatus.BAD_REQUEST,"RETENTION_CONFIRMATION_REQUIRED","Exact retention confirmation is required");
    if(!retentionEnabled)throw new ApiException(HttpStatus.CONFLICT,"RETENTION_DISABLED","Retention execution is disabled");
    ensureFresh("DATABASE_BACKUP",dbRpo);ensureFresh("OBJECT_BACKUP",objectRpo);ensureFresh("RESTORE_DRILL",drillDays*86400L);
    UUID id=UUID.randomUUID();String payload=toJson(Map.of("requestedAt",OffsetDateTime.now().toString(),"policyVersion","D6-2026-08"));
    jdbc.sql("INSERT INTO \"Job\" (id,type,status,progress,payload,attempts,\"maxAttempts\",\"availableAt\",\"requestedById\",\"createdAt\",\"updatedAt\") VALUES (:id,'RETENTION_CLEANUP','QUEUED',0,CAST(:payload AS jsonb),0,1,CURRENT_TIMESTAMP,:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("payload",payload).param("actor",principal.id()).update();return Map.of("jobId",id,"status","QUEUED");
  }
  public Map<String,Object> record(String provided,Evidence evidence){
    if(evidenceToken.isBlank()||provided==null||!MessageDigest.isEqual(evidenceToken.getBytes(StandardCharsets.UTF_8),provided.getBytes(StandardCharsets.UTF_8)))throw new ApiException(HttpStatus.UNAUTHORIZED,"EVIDENCE_AUTH_INVALID","Evidence authentication failed");
    if(evidence.completedAt().isBefore(evidence.startedAt())||evidence.completedAt().isAfter(OffsetDateTime.now().plusMinutes(5)))throw new ApiException(HttpStatus.BAD_REQUEST,"EVIDENCE_INVALID","Evidence timestamps are invalid");
    UUID id=UUID.randomUUID();
    var statement=evidence.type()==EvidenceType.RESTORE_DRILL
      ? jdbc.sql("INSERT INTO \"RestoreDrill\" (id,status,\"snapshotId\",\"sourceHost\",checksum,\"objectCount\",\"totalBytes\",\"startedAt\",\"completedAt\",details,\"createdAt\") VALUES (:id,CAST(:status AS \"ResilienceEvidenceStatus\"),:snapshot,:host,:checksum,:count,:bytes,:started,:completed,CAST(:details AS jsonb),CURRENT_TIMESTAMP)")
      : jdbc.sql("INSERT INTO \"BackupEvidence\" (id,type,status,\"snapshotId\",\"sourceHost\",checksum,\"objectCount\",\"totalBytes\",\"startedAt\",\"completedAt\",details,\"createdAt\") VALUES (:id,CAST(:type AS \"BackupEvidenceType\"),CAST(:status AS \"ResilienceEvidenceStatus\"),:snapshot,:host,:checksum,:count,:bytes,:started,:completed,CAST(:details AS jsonb),CURRENT_TIMESTAMP)").param("type",evidence.type().name());
    statement.param("id",id).param("status",evidence.status().name()).param("snapshot",evidence.snapshotId()).param("host",evidence.sourceHost()).param("checksum",evidence.checksum()).param("count",evidence.objectCount()).param("bytes",evidence.totalBytes()).param("started",evidence.startedAt()).param("completed",evidence.completedAt()).param("details",toJson(evidence.details()==null?Map.of():evidence.details())).update();return Map.of("id",id,"accepted",true);
  }
  private Map<String,Object> latest(String type,long maxAge){
    var query="RESTORE_DRILL".equals(type)
      ? jdbc.sql("SELECT status::text status,\"snapshotId\",\"completedAt\" FROM \"RestoreDrill\" ORDER BY \"completedAt\" DESC LIMIT 1")
      : jdbc.sql("SELECT status::text status,\"snapshotId\",\"completedAt\" FROM \"BackupEvidence\" WHERE type=CAST(:type AS \"BackupEvidenceType\") ORDER BY \"completedAt\" DESC LIMIT 1").param("type",type);
    var found=query.query((rs,n)->new EvidenceRow(rs.getString(1),rs.getString(2),rs.getObject(3,OffsetDateTime.class))).optional();
    if(found.isEmpty())return Map.of("status","not_checked","message","No evidence has been reported");var row=found.get();long age=Math.max(0,ChronoUnit.SECONDS.between(row.completedAt(),OffsetDateTime.now()));String status="SUCCEEDED".equals(row.status())&&age<=maxAge?"healthy":"unhealthy";var result=new LinkedHashMap<String,Object>();result.put("status",status);result.put("completedAt",row.completedAt());result.put("ageSeconds",age);if(row.snapshotId()!=null)result.put("snapshotId",row.snapshotId());result.put("message","healthy".equals(status)?"Evidence is within the recovery objective":"Evidence is failed or stale");return result;
  }
  private void ensureFresh(String type,long maxAge){Map<String,Object> value=latest(type,maxAge);if(!"healthy".equals(value.get("status")))throw new ApiException(HttpStatus.CONFLICT,"RESILIENCE_GATE_FAILED","Fresh backup and restore evidence is required before retention");}
  private long count(String sql){return jdbc.sql(sql).query(Long.class).single();}
  private String toJson(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException error){throw new ApiException(HttpStatus.BAD_REQUEST,"EVIDENCE_INVALID","Evidence details are invalid");}}
  public enum EvidenceType{DATABASE_BACKUP,OBJECT_BACKUP,RESTORE_DRILL}public enum EvidenceStatus{SUCCEEDED,FAILED}
  public record Evidence(EvidenceType type,EvidenceStatus status,String snapshotId,String sourceHost,String checksum,Long objectCount,Long totalBytes,OffsetDateTime startedAt,OffsetDateTime completedAt,Map<String,Object> details){}
  record EvidenceRow(String status,String snapshotId,OffsetDateTime completedAt){}
}
