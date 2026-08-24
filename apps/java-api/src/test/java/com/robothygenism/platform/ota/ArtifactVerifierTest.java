package com.robothygenism.platform.ota;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.robothygenism.platform.common.ApiException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class ArtifactVerifierTest {
  private final ArtifactVerifier verifier = new ArtifactVerifier();

  @Test void verifiesChecksumBeforeArtifactPublication() {
    var checksum = verifier.sha256(new ByteArrayInputStream("package".getBytes(StandardCharsets.UTF_8)));
    assertThat(checksum).hasSize(64);
    verifier.requireChecksum(checksum, checksum);
    assertThatThrownBy(() -> verifier.requireChecksum("0".repeat(64), checksum)).isInstanceOf(ApiException.class).hasMessage("Artifact checksum verification failed");
  }

  @Test void verifiesEd25519SignatureOverRawSha256Digest() throws Exception {
    var keys = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var checksum = verifier.sha256(new ByteArrayInputStream("signed".getBytes(StandardCharsets.UTF_8)));
    var signer = Signature.getInstance("Ed25519");
    signer.initSign(keys.getPrivate()); signer.update(HexFormat.of().parseHex(checksum));
    var signature = Base64.getEncoder().encodeToString(signer.sign());
    var publicKey = Base64.getEncoder().encodeToString(keys.getPublic().getEncoded());
    verifier.verifyEd25519(checksum, signature, publicKey);
    assertThatThrownBy(() -> verifier.verifyEd25519("0".repeat(64), signature, publicKey)).isInstanceOf(ApiException.class);
  }
}
