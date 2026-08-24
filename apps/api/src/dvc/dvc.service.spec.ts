import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { DvcService, parseDvcHash } from './dvc.service';

describe('DvcService repository boundary', () => {
  const repository = resolve('dvc-test-repository');
  const service = new DvcService(new ConfigService({ DVC_REPOSITORY_ROOT: repository }));

  it('resolves a dataset workspace inside the mounted repository', () => {
    expect(service.resolveWorkspace('data/datasets/example/v1')).toBe(resolve(repository, 'data/datasets/example/v1'));
  });

  it('rejects the repository root and traversal outside it', () => {
    expect(() => service.resolveWorkspace('.')).toThrow(ServiceUnavailableException);
    expect(() => service.resolveWorkspace('../secret')).toThrow(ServiceUnavailableException);
  });

  it('isolates DVC global state inside the configured repository by default', () => {
    const environment = (service as unknown as { dvcEnvironment(): Record<string, string> }).dvcEnvironment();
    expect(environment.DVC_NO_ANALYTICS).toBe('true');
    expect(environment.DVC_SYSTEM_CONFIG_DIR).toBe(resolve(repository, '.dvc', 'tmp', 'runtime', 'system-config'));
    expect(environment.DVC_GLOBAL_CONFIG_DIR).toBe(resolve(repository, '.dvc', 'tmp', 'runtime', 'global-config'));
    expect(environment.DVC_SITE_CACHE_DIR).toBe(resolve(repository, '.dvc', 'tmp', 'runtime', 'site-cache'));
  });
});

describe('DVC pointer parsing', () => {
  it('accepts file and directory pointer formats emitted by DVC 3.x', () => {
    expect(parseDvcHash('outs:\n- md5: abc123.dir\n  path: data')).toBe('abc123.dir');
    expect(parseDvcHash('md5: def456\npath: sample.json')).toBe('def456');
  });
});
