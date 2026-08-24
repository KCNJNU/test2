import { ConfigService } from '@nestjs/config';
import { BuildInfoService } from './build-info.service';

describe('BuildInfoService', () => {
  it('returns validated immutable build metadata', () => {
    const config = new ConfigService({ RUNTIME_SERVICE_NAME: 'api', APP_VERSION: 'v1.2.3', GIT_COMMIT: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01', BUILD_TIME: '2026-08-23T00:00:00Z' });
    expect(new BuildInfoService(config).get()).toEqual({ service: 'api', version: 'v1.2.3', gitCommit: 'abcdef0123456789abcdef0123456789abcdef01', buildTime: '2026-08-23T00:00:00.000Z' });
  });

  it('does not echo malformed or secret-bearing configuration', () => {
    const config = new ConfigService({ RUNTIME_SERVICE_NAME: 'api?token=secret', APP_VERSION: 'password=secret', GIT_COMMIT: 'secret', BUILD_TIME: 'secret' });
    const result = new BuildInfoService(config).get();
    expect(result).toEqual({ service: 'unknown', version: '0.0.0-dev', gitCommit: 'unknown', buildTime: 'unknown' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
