package com.robothygenism.platform.identity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.common.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class VaultPkiRevocationClient {
  private final String agentUrl; private final String mount; private final ObjectMapper json;
  private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
  public VaultPkiRevocationClient(@Value("${d6.vault.agent-proxy-url:}") String agentUrl,@Value("${d6.vault.pki-mount:pki}") String mount,ObjectMapper json){this.agentUrl=agentUrl;this.mount=mount;this.json=json;}
  public void revoke(String serialNumber){
    if(agentUrl==null||agentUrl.isBlank())throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"CERTIFICATE_REVOCATION_UNAVAILABLE","Certificate revocation service is not configured");
    try{
      URI uri=URI.create(agentUrl.replaceAll("/$","")+"/v1/"+mount+"/revoke");
      HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(5)).header("Content-Type","application/json").header("X-Vault-Request","true").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("serial_number",serialNumber)))).build();
      HttpResponse<Void> response=http.send(request,HttpResponse.BodyHandlers.discarding());
      if(response.statusCode()<200||response.statusCode()>=300)throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"CERTIFICATE_REVOCATION_FAILED","Certificate authority rejected the revocation");
    }catch(ApiException error){throw error;}
    catch(Exception error){throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"CERTIFICATE_REVOCATION_UNAVAILABLE","Certificate revocation service is unavailable");}
  }
}
