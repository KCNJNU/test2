package com.robothygenism.platform.ota;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ConfigChecksumServiceTest {
  @Test void objectKeyOrderDoesNotChangeTheConfigurationChecksum() throws Exception {
    var json = new ObjectMapper();
    var service = new ConfigChecksumService(json, new ArtifactVerifier());
    assertThat(service.checksum(json.readTree("{\"navigation\":{\"speed\":1,\"mode\":\"safe\"},\"enabled\":true}")))
        .isEqualTo(service.checksum(json.readTree("{\"enabled\":true,\"navigation\":{\"mode\":\"safe\",\"speed\":1}}")));
  }
}
