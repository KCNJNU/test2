import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

@Injectable()
export class DvcService {
  private readonly repositoryRoot = resolve(__dirname, '..', '..', '..', '..');

  constructor(private readonly config: ConfigService) {}

  async publish(workspacePath: string, datasetName: string, version: number): Promise<{ dvcPath: string; dvcHash: string; gitCommit: string; gitTag: string }> {
    const relativeWorkspacePath = workspacePath.replace(/\\/g, '/');
    const remote = this.remoteConfig();
    if (remote.bucket === this.config.getOrThrow<string>('OBJECT_STORAGE_BUCKET')) {
      throw new ServiceUnavailableException('DVC remote bucket must not be the raw object-storage bucket');
    }
    await this.ensureDvcRepository(remote);
    await this.runDvc(['add', relativeWorkspacePath], remote);
    const dvcPath = `${relativeWorkspacePath}.dvc`;
    const dvcHash = await this.readDvcHash(dvcPath);
    await this.runDvc(['push'], remote);

    const gitTag = this.datasetTag(datasetName, version);
    const tagExists = await this.runGit(['rev-parse', '-q', '--verify', `refs/tags/${gitTag}`], true);
    if (tagExists.code === 0) {
      return { dvcPath, dvcHash, gitCommit: (await this.runGit(['rev-list', '-n', '1', gitTag])).stdout.trim(), gitTag };
    }
    await this.runGit(['add', '--', '.dvc/config', dvcPath]);
    const staged = await this.runGit(['diff', '--cached', '--quiet'], true);
    if (staged.code !== 0) await this.runGit(['-c', `user.name=${remote.gitAuthorName}`, '-c', `user.email=${remote.gitAuthorEmail}`, 'commit', '-m', `Publish dataset ${datasetName} v${version}.0.0`]);
    const gitCommit = (await this.runGit(['rev-parse', 'HEAD'])).stdout.trim();
    await this.runGit(['-c', `user.name=${remote.gitAuthorName}`, '-c', `user.email=${remote.gitAuthorEmail}`, 'tag', '-a', gitTag, '-m', `Dataset ${datasetName} version ${version}.0.0`]);
    return { dvcPath, dvcHash, gitCommit, gitTag };
  }

  private async ensureDvcRepository(remote: ReturnType<DvcService['remoteConfig']>) {
    try { await access(resolve(this.repositoryRoot, '.dvc', 'config')); }
    catch { await this.runDvc(['init']); }
    await this.runDvc(['remote', 'add', '-f', '-d', remote.name, `s3://${remote.bucket}`], remote);
    await this.runDvc(['remote', 'modify', '-f', remote.name, 'endpointurl', remote.endpointUrl], remote);
    await this.runDvc(['remote', 'modify', '-f', remote.name, 'use_ssl', String(remote.useSsl)], remote);
  }

  private async readDvcHash(dvcPath: string) {
    const pointer = await readFile(resolve(this.repositoryRoot, dvcPath), 'utf8');
    const hash = /^\s*md5:\s*([^\s]+)$/m.exec(pointer)?.[1];
    if (!hash) throw new ServiceUnavailableException(`Unable to read DVC hash from ${dvcPath}`);
    return hash;
  }

  private remoteConfig() {
    const useSsl = this.config.getOrThrow<string>('DVC_REMOTE_USE_SSL') === 'true';
    const endpoint = this.config.getOrThrow<string>('DVC_REMOTE_ENDPOINT');
    const port = this.config.getOrThrow<string>('DVC_REMOTE_PORT');
    return {
      name: this.config.getOrThrow<string>('DVC_REMOTE_NAME'), bucket: this.config.getOrThrow<string>('DVC_REMOTE_BUCKET'),
      endpointUrl: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`, useSsl,
      accessKey: this.config.getOrThrow<string>('DVC_REMOTE_ACCESS_KEY'), secretKey: this.config.getOrThrow<string>('DVC_REMOTE_SECRET_KEY'),
      gitAuthorName: this.config.getOrThrow<string>('DATASET_PUBLISH_GIT_AUTHOR_NAME'), gitAuthorEmail: this.config.getOrThrow<string>('DATASET_PUBLISH_GIT_AUTHOR_EMAIL'),
    };
  }

  private datasetTag(name: string, version: number) { return `dataset-${name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')}-v${version}.0.0`; }
  private async runDvc(args: string[], remote?: ReturnType<DvcService['remoteConfig']>) { return this.run(this.config.getOrThrow<string>('DVC_COMMAND'), args, remote); }
  private async runGit(args: string[], allowFailure = false) { return this.run('git', args, undefined, allowFailure); }
  private async run(command: string, args: string[], remote?: ReturnType<DvcService['remoteConfig']>, allowFailure = false): Promise<{ stdout: string; code: number }> {
    try {
      const result = await execFileAsync(command, args, { cwd: this.repositoryRoot, env: { ...process.env, ...(remote && { AWS_ACCESS_KEY_ID: remote.accessKey, AWS_SECRET_ACCESS_KEY: remote.secretKey }) } });
      return { stdout: result.stdout, code: 0 };
    } catch (error: unknown) {
      const failed = error as { code?: number | string; stdout?: string; stderr?: string; message: string };
      if (allowFailure) return { stdout: failed.stdout ?? '', code: typeof failed.code === 'number' ? failed.code : 1 };
      throw new ServiceUnavailableException(`${command} ${args[0]} failed: ${failed.stderr ?? failed.message}`);
    }
  }
}
