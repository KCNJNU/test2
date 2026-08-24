import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../auth/auth.decorators';

@ApiTags('system')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and infrastructure dependency health' })
  @ApiOkResponse({ schema: { example: {
    status: 'healthy', timestamp: '2026-08-14T12:00:00.000Z',
    services: {
      api: { status: 'healthy', message: 'Responding normally' },
      postgresql: { status: 'healthy', message: 'Database connection successful' },
      redis: { status: 'healthy', provider: 'redis', message: 'Redis PING successful' },
      mqtt: { status: 'healthy', provider: 'emqx', message: 'MQTT CONNECT successful' },
      objectStorage: { status: 'healthy', provider: 'minio', bucket: 'robot-raw-files', message: 'Bucket reachable' },
      messageQueue: { status: 'healthy', provider: 'postgresql', message: 'PostgreSQL job queue reachable' },
      dvcRemote: { status: 'healthy', provider: 's3-compatible', bucket: 'robot-dvc-store', message: 'DVC remote reachable' },
      worker: { status: 'healthy', message: 'Worker heartbeat received 2s ago' },
      certificate: { status: 'healthy', provider: 'vault-pki', message: 'Active device certificates are within their renewal window' },
      backup: { status: 'healthy', provider: 'restic', message: 'Database and object backups are within RPO' },
      restoreDrill: { status: 'healthy', provider: 'restore-drill', message: 'Evidence is within the recovery objective' },
      retention: { status: 'healthy', message: 'Latest retention job status: SUCCEEDED' },
    },
  } } })
  getHealth() { return this.health.check(); }
}
