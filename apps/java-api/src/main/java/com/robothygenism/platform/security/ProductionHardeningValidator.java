package com.robothygenism.platform.security;

import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class ProductionHardeningValidator implements ApplicationRunner {
  private final String environment;private final String mqtt;private final String rateSalt;private final String evidenceToken;private final String vaultProxy;
  public ProductionHardeningValidator(@Value("${DEPLOYMENT_ENVIRONMENT:DEV}")String environment,@Value("${MQTT_BROKER_URI:}")String mqtt,@Value("${RATE_LIMIT_KEY_SALT:}")String rateSalt,@Value("${RESILIENCE_EVIDENCE_TOKEN:}")String evidenceToken,@Value("${VAULT_AGENT_PROXY_URL:}")String vaultProxy){this.environment=environment;this.mqtt=mqtt;this.rateSalt=rateSalt;this.evidenceToken=evidenceToken;this.vaultProxy=vaultProxy;}
  @Override public void run(ApplicationArguments args){if(!"PRODUCTION".equals(environment.toUpperCase(Locale.ROOT)))return;if(!mqtt.startsWith("mqtts://"))throw new IllegalStateException("Production requires MQTT TLS");required("RATE_LIMIT_KEY_SALT",rateSalt);required("RESILIENCE_EVIDENCE_TOKEN",evidenceToken);required("VAULT_AGENT_PROXY_URL",vaultProxy);}
  private void required(String name,String value){if(value==null||value.isBlank()||value.contains("replace-me")||value.contains("development-only"))throw new IllegalStateException("Production security configuration "+name+" is invalid");}
}
