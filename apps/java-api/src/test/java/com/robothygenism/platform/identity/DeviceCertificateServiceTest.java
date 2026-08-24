package com.robothygenism.platform.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import com.robothygenism.platform.common.ApiException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

class DeviceCertificateServiceTest {
  private final DeviceCertificateService service = new DeviceCertificateService(mock(JdbcClient.class), mock(VaultPkiRevocationClient.class));

  @Test void rejectsPrivateKeyMaterial() {
    var error=assertThrows(ApiException.class,()->service.parse("-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",UUID.randomUUID()));
    assertEquals("CERTIFICATE_INVALID",error.code());
  }

  @Test void rejectsMalformedPublicCertificateWithoutLeakingParserDetails() {
    var error=assertThrows(ApiException.class,()->service.parse("-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----",UUID.randomUUID()));
    assertEquals("CERTIFICATE_INVALID",error.code());
    assertEquals("Certificate is invalid, expired, or does not match the robot identity",error.getMessage());
  }
}
