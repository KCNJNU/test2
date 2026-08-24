package com.robothygenism.platform.ota;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Comparator;
import org.springframework.stereotype.Service;

@Service
public class ConfigChecksumService {
  private final ObjectMapper json;
  private final ArtifactVerifier verifier;

  public ConfigChecksumService(ObjectMapper json, ArtifactVerifier verifier) { this.json = json; this.verifier = verifier; }

  public String checksum(JsonNode content) {
    try { return verifier.sha256(new ByteArrayInputStream(json.writeValueAsBytes(canonical(content)))); }
    catch (Exception error) { throw new IllegalArgumentException("Configuration content is not serializable", error); }
  }

  private JsonNode canonical(JsonNode value) {
    if (value.isObject()) {
      ObjectNode result = json.createObjectNode();
      var names = new ArrayList<String>(); value.fieldNames().forEachRemaining(names::add); names.sort(Comparator.naturalOrder());
      for (var name : names) result.set(name, canonical(value.get(name)));
      return result;
    }
    if (value.isArray()) {
      ArrayNode result = json.createArrayNode(); value.forEach(item -> result.add(canonical(item))); return result;
    }
    return value;
  }
}
