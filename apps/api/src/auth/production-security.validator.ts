import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductionSecurityValidator implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}
  onModuleInit() {
    if (this.config.get<string>('DEPLOYMENT_ENVIRONMENT')?.toUpperCase() !== 'PRODUCTION' || process.env.RUNTIME_SERVICE_NAME !== 'api') return;
    const broker = this.required('MQTT_BROKER_URI');
    if (!broker.startsWith('mqtts://')) throw new Error('Production API requires MQTT TLS');
    for (const key of ['RATE_LIMIT_KEY_SALT', 'RESILIENCE_EVIDENCE_TOKEN', 'MQTT_HEALTH_TLS_CA_FILE', 'MQTT_HEALTH_TLS_CERT_FILE', 'MQTT_HEALTH_TLS_KEY_FILE', 'MQTT_TLS_SERVER_NAME']) this.required(key);
  }
  private required(key: string) {
    const value = this.config.getOrThrow<string>(key).trim();
    if (!value || /replace-me|development-only/i.test(value)) throw new Error(`Production security configuration ${key} is invalid`);
    return value;
  }
}
