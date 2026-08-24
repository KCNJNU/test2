import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BuildInfo = { service: string; version: string; gitCommit: string; buildTime: string };

@Injectable()
export class BuildInfoService {
  constructor(private readonly config: ConfigService) {}

  get(): BuildInfo {
    return {
      service: safe(this.config.get<string>('RUNTIME_SERVICE_NAME') ?? process.env.RUNTIME_SERVICE_NAME, 'unknown'),
      version: semver(this.config.get<string>('APP_VERSION')),
      gitCommit: commit(this.config.get<string>('GIT_COMMIT')),
      buildTime: timestamp(this.config.get<string>('BUILD_TIME')),
    };
  }
}

function safe(value: string | undefined, fallback: string) { return value && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : fallback; }
function semver(value: string | undefined) { return value && /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value) ? value : '0.0.0-dev'; }
function commit(value: string | undefined) { return value && /^[0-9a-f]{7,40}$/i.test(value) ? value.toLowerCase() : 'unknown'; }
function timestamp(value: string | undefined) { return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : 'unknown'; }
