package com.robothygenism.platform.identity;

import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.naming.ldap.LdapName;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DeviceCertificateService {
  private final JdbcClient jdbc; private final VaultPkiRevocationClient vault;
  public DeviceCertificateService(JdbcClient jdbc,VaultPkiRevocationClient vault){this.jdbc=jdbc;this.vault=vault;}

  public List<Map<String,Object>> list(PlatformPrincipal principal,UUID robotId){authorize(principal,robotId);return jdbc.sql("SELECT id,\"robotId\",\"fingerprintSha256\",\"serialNumber\",\"subjectCn\",issuer,\"notBefore\",\"notAfter\",status::text status,\"revokedAt\",\"revocationReason\",\"createdAt\" FROM \"DeviceCertificate\" WHERE \"robotId\"=:robot ORDER BY \"createdAt\" DESC").param("robot",robotId).query().listOfRows();}

  @Transactional
  public Map<String,Object> register(PlatformPrincipal principal,UUID robotId,String pem){
    var robot=authorize(principal,robotId); if(robot.tenantId()==null)throw new ApiException(HttpStatus.CONFLICT,"ROBOT_TENANT_REQUIRED","Robot must belong to a tenant before certificate registration"); ParsedCertificate certificate=parse(pem,robotId);
    UUID id=UUID.randomUUID();
    try{jdbc.sql("INSERT INTO \"DeviceCertificate\" (id,\"robotId\",\"certificatePem\",\"fingerprintSha256\",\"serialNumber\",\"subjectCn\",issuer,\"notBefore\",\"notAfter\",status,\"registeredById\",\"createdAt\",\"updatedAt\") VALUES (:id,:robot,:pem,:fingerprint,:serial,:cn,:issuer,:notBefore,:notAfter,'ACTIVE',:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("robot",robotId).param("pem",pem.trim()).param("fingerprint",certificate.fingerprint()).param("serial",certificate.serial()).param("cn",certificate.cn()).param("issuer",certificate.issuer()).param("notBefore",certificate.notBefore()).param("notAfter",certificate.notAfter()).param("actor",principal.id()).update();}
    catch(DuplicateKeyException error){throw new ApiException(HttpStatus.CONFLICT,"CERTIFICATE_ALREADY_REGISTERED","Certificate is already registered");}
    return Map.of("id",id,"robotId",robotId,"fingerprintSha256",certificate.fingerprint(),"serialNumber",certificate.serial(),"subjectCn",certificate.cn(),"issuer",certificate.issuer(),"notBefore",certificate.notBefore(),"notAfter",certificate.notAfter(),"status","ACTIVE","tenantId",robot.tenantId());
  }

  @Transactional
  public Map<String,Object> revoke(PlatformPrincipal principal,UUID robotId,UUID certificateId,String reason){
    authorize(principal,robotId);
    var row=jdbc.sql("SELECT \"serialNumber\",status::text status FROM \"DeviceCertificate\" WHERE id=:id AND \"robotId\"=:robot FOR UPDATE").param("id",certificateId).param("robot",robotId).query((rs,n)->Map.of("serial",rs.getString(1),"status",rs.getString(2))).optional().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Certificate not found"));
    if("REVOKED".equals(row.get("status")))return Map.of("id",certificateId,"status","REVOKED");
    vault.revoke((String)row.get("serial"));
    jdbc.sql("UPDATE \"DeviceCertificate\" SET status='REVOKED',\"revokedById\"=:actor,\"revokedAt\"=CURRENT_TIMESTAMP,\"revocationReason\"=:reason,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("actor",principal.id()).param("reason",reason).param("id",certificateId).update();
    return Map.of("id",certificateId,"status","REVOKED");
  }

  private RobotScope authorize(PlatformPrincipal principal,UUID robotId){
    RobotScope robot=jdbc.sql("SELECT \"tenantId\",\"projectId\" FROM \"Robot\" WHERE id=:id").param("id",robotId).query((rs,n)->new RobotScope((UUID)rs.getObject(1),(UUID)rs.getObject(2))).optional().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Robot not found"));
    if(principal.superAdmin()||principal.tenantId()!=null&&principal.tenantId().equals(robot.tenantId())&&(principal.role().equals("TENANT_ADMIN")||robot.projectId()!=null&&principal.projectIds().contains(robot.projectId())))return robot;
    throw new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Robot not found");
  }

  ParsedCertificate parse(String pem,UUID robotId){
    if(pem==null||pem.isBlank()||pem.contains("PRIVATE KEY"))throw new ApiException(HttpStatus.BAD_REQUEST,"CERTIFICATE_INVALID","A public X.509 certificate is required");
    try{
      X509Certificate certificate=(X509Certificate)CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(pem.getBytes(StandardCharsets.US_ASCII)));
      certificate.checkValidity(); String cn=null;
      for(var rdn:new LdapName(certificate.getSubjectX500Principal().getName()).getRdns())if("CN".equalsIgnoreCase(rdn.getType()))cn=String.valueOf(rdn.getValue());
      if(cn==null||cn.contains("/")||cn.contains("+")||cn.contains("#")||!UUID.fromString(cn).equals(robotId))throw new IllegalArgumentException("CN mismatch");
      String fingerprint=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
      return new ParsedCertificate(fingerprint,certificate.getSerialNumber().toString(16),cn,certificate.getIssuerX500Principal().getName(),certificate.getNotBefore().toInstant().atOffset(ZoneOffset.UTC),certificate.getNotAfter().toInstant().atOffset(ZoneOffset.UTC));
    }catch(Exception error){throw new ApiException(HttpStatus.BAD_REQUEST,"CERTIFICATE_INVALID","Certificate is invalid, expired, or does not match the robot identity");}
  }
  record ParsedCertificate(String fingerprint,String serial,String cn,String issuer,OffsetDateTime notBefore,OffsetDateTime notAfter){}
  record RobotScope(UUID tenantId,UUID projectId){}
}
