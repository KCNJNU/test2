import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function parseDvcHash(pointer: string) {
  return /^\s*(?:-\s*)?md5:\s*([^\s]+)$/m.exec(pointer)?.[1];
}

@Injectable()
export class DvcService {
  private readonly repositoryRoot: string;

  constructor(private readonly config: ConfigService) {
    this.repositoryRoot = resolve(this.config.get<string>('DVC_REPOSITORY_ROOT') ?? resolve(__dirname, '..', '..', '..', '..'));
  }

  resolveWorkspace(workspacePath: string) {
    const target = resolve(this.repositoryRoot, workspacePath);
    const child = relative(this.repositoryRoot, target);
    if (child.startsWith('..') || target === this.repositoryRoot) throw new ServiceUnavailableException('DVC workspace path is outside the configured repository');
    return target;
  }

  async checkRemoteHealth(): Promise<{ configured: false } | { configured: true; provider: string; bucket: string; reachable: boolean }> {
    const endPoint = this.config.get<string>('DVC_REMOTE_ENDPOINT');
    const port = this.config.get<string>('DVC_REMOTE_PORT');
    const useSsl = this.config.get<string>('DVC_REMOTE_USE_SSL');
    const bucket = this.config.get<string>('DVC_REMOTE_BUCKET');
    const accessKey = this.config.get<string>('DVC_REMOTE_ACCESS_KEY');
    const secretKey = this.config.get<string>('DVC_REMOTE_SECRET_KEY');
    const remoteName = this.config.get<string>('DVC_REMOTE_NAME');
    if (!endPoint || !port || !useSsl || !bucket || !accessKey || !secretKey || !remoteName) return { configured: false };
    const client = new Minio.Client({ endPoint, port: Number(port), useSSL: useSsl === 'true', accessKey, secretKey });
    try { return { configured: true, provider: 's3-compatible', bucket, reachable: await client.bucketExists(bucket) }; }
    catch { return { configured: true, provider: 's3-compatible', bucket, reachable: false }; }
  }

  async publish(workspacePath: string, datasetName: string, version: number, runStep: <T>(name: string, action: () => Promise<T>) => Promise<T> = (_name, action) => action()): Promise<{ dvcPath: string; dvcHash: string; gitCommit: string; gitTag: string }> {
    const relativeWorkspacePath = workspacePath.replace(/\\/g, '/');
    const remote = this.remoteConfig();
    if (remote.bucket === this.config.getOrThrow<string>('OBJECT_STORAGE_BUCKET')) {
      throw new ServiceUnavailableException('DVC remote bucket must not be the raw object-storage bucket');
    }
    await this.ensureDvcRepository(remote);
    await runStep('DVC Add', () => this.runDvc(['add', relativeWorkspacePath], remote));
    const dvcPath = `${relativeWorkspacePath}.dvc`;
    const dvcHash = await this.readDvcHash(dvcPath);
    await runStep('DVC Push', () => this.runDvc(['push'], remote));

    return runStep('Git Commit/Tag', async () => {
      const gitTag = this.datasetTag(datasetName, version);
      const tagExists = await this.runGit(['rev-parse', '-q', '--verify', `refs/tags/${gitTag}`], true);
      if (tagExists.code === 0) return { dvcPath, dvcHash, gitCommit: (await this.runGit(['rev-list', '-n', '1', gitTag])).stdout.trim(), gitTag };
      await this.runGit(['add', '--', '.dvc/config', dvcPath]);
      const staged = await this.runGit(['diff', '--cached', '--quiet'], true);
      if (staged.code !== 0) await this.runGit(['-c', `user.name=${remote.gitAuthorName}`, '-c', `user.email=${remote.gitAuthorEmail}`, 'commit', '-m', `Publish dataset ${datasetName} v${version}.0.0`]);
      const gitCommit = (await this.runGit(['rev-parse', 'HEAD'])).stdout.trim();
      await this.runGit(['-c', `user.name=${remote.gitAuthorName}`, '-c', `user.email=${remote.gitAuthorEmail}`, 'tag', '-a', gitTag, '-m', `Dataset ${datasetName} version ${version}.0.0`]);
      return { dvcPath, dvcHash, gitCommit, gitTag };
    });
  }

  async recoveryVerify(gitTag: string, dvcPath: string, verify: (workspaceRoot: string) => Promise<void>, runStep: <T>(name: string, action: () => Promise<T>) => Promise<T>) {
    const remote = this.remoteConfig();
    const temporaryRoot = await runStep('Prepare Temporary Workspace', () => mkdtemp(join(tmpdir(), 'robot-dvc-recovery-')));
    try {
      await runStep('Checkout Git Tag', () => this.runGit(['worktree', 'add', '--detach', temporaryRoot, gitTag]));
      await runStep('DVC Pull', () => this.run(this.config.getOrThrow<string>('DVC_COMMAND'), ['pull', dvcPath], remote, false, temporaryRoot));
      await verify(temporaryRoot);
      return { verified: true, gitTag, dvcPath };
    } finally {
      await runStep('Cleanup', async () => { await this.runGit(['worktree', 'remove', '--force', temporaryRoot], true); await rm(temporaryRoot, { recursive: true, force: true }); });
    }
  }

  private async ensureDvcRepository(remote: ReturnType<DvcService['remoteConfig']>) {
    try { await access(resolve(this.repositoryRoot, '.dvc', 'config')); }
    catch { await this.runDvc(['init']); }
    await this.runDvc(['remote', 'add', '-f', '-d', remote.name, `s3://${remote.bucket}`], remote);
    await this.runDvc(['remote', 'modify', remote.name, 'endpointurl', remote.endpointUrl], remote);
    await this.runDvc(['remote', 'modify', remote.name, 'use_ssl', String(remote.useSsl)], remote);
  }

  private async readDvcHash(dvcPath: string) {
    const pointer = await readFile(resolve(this.repositoryRoot, dvcPath), 'utf8');
    const hash = parseDvcHash(pointer);
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
  private dvcEnvironment() {
    const runtimeRoot = resolve(this.repositoryRoot, '.dvc', 'tmp', 'runtime');
    return {
      DVC_NO_ANALYTICS: this.config.get<string>('DVC_NO_ANALYTICS') ?? 'true',
      DVC_SYSTEM_CONFIG_DIR: this.config.get<string>('DVC_SYSTEM_CONFIG_DIR') ?? resolve(runtimeRoot, 'system-config'),
      DVC_GLOBAL_CONFIG_DIR: this.config.get<string>('DVC_GLOBAL_CONFIG_DIR') ?? resolve(runtimeRoot, 'global-config'),
      DVC_SITE_CACHE_DIR: this.config.get<string>('DVC_SITE_CACHE_DIR') ?? resolve(runtimeRoot, 'site-cache'),
    };
  }
  private async run(command: string, args: string[], remote?: ReturnType<DvcService['remoteConfig']>, allowFailure = false, cwd = this.repositoryRoot): Promise<{ stdout: string; code: number }> {
    try {
      const dvcEnvironment = command === this.config.get<string>('DVC_COMMAND') ? this.dvcEnvironment() : {};
      const result = await execFileAsync(command, args, { cwd, env: { ...process.env, ...dvcEnvironment, ...(remote && { AWS_ACCESS_KEY_ID: remote.accessKey, AWS_SECRET_ACCESS_KEY: remote.secretKey }) } });
      return { stdout: result.stdout, code: 0 };
    } catch (error: unknown) {
      const failed = error as { code?: number | string; stdout?: string; stderr?: string; message: string };
      if (allowFailure) return { stdout: failed.stdout ?? '', code: typeof failed.code === 'number' ? failed.code : 1 };
      throw new ServiceUnavailableException(`${command} ${args[0]} failed: ${failed.stderr ?? failed.message}`);
    }
  }
}
