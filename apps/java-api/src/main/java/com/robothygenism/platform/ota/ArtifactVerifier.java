package com.robothygenism.platform.ota;

import com.robothygenism.platform.common.ApiException;
import java.io.InputStream;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ArtifactVerifier {
  public String sha256(InputStream input) {
    try (input) {
      var digest = MessageDigest.getInstance("SHA-256");
      input.transferTo(new java.io.OutputStream() {
        @Override public void write(int value) { digest.update((byte) value); }
        @Override public void write(byte[] value, int offset, int length) { digest.update(value, offset, length); }
      });
      return HexFormat.of().formatHex(digest.digest());
    } catch (Exception error) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ARTIFACT_READ_FAILED", "Unable to verify the artifact");
    }
  }

  public void requireChecksum(String expected, String actual) {
    if (expected == null || !expected.matches("[0-9a-fA-F]{64}") || !MessageDigest.isEqual(HexFormat.of().parseHex(expected), HexFormat.of().parseHex(actual))) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "CHECKSUM_MISMATCH", "Artifact checksum verification failed");
    }
  }

  public void verifyEd25519(String checksum, String signatureBase64, String publicKeyBase64) {
    try {
      var publicKey = KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyBase64)));
      var verifier = Signature.getInstance("Ed25519");
      verifier.initVerify(publicKey);
      verifier.update(HexFormat.of().parseHex(checksum));
      if (!verifier.verify(Base64.getDecoder().decode(signatureBase64))) throw new IllegalArgumentException("invalid signature");
    } catch (Exception error) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SIGNATURE_INVALID", "Artifact signature verification failed");
    }
  }
}
