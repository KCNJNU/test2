import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { DvcService } from '../dvc/dvc.service';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';

@Injectable()
export class DatasetPublishService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage, private readonly dvc: DvcService) {}

  async publish(id: string, runStep: <T>(name: string, action: () => Promise<T>) => Promise<T> = (_name, action) => action()) {
    const { version, manifest } = await runStep('Validation', async () => {
      const value = await this.prisma.datasetVersion.findUnique({ where: { id }, include: { dataset: true, files: { include: { robotFile: true }, orderBy: { robotFileId: 'asc' } } } });
      if (!value) throw new NotFoundException('Dataset version not found');
      const publishable = value.status === DatasetVersionStatus.FROZEN
        || value.status === DatasetVersionStatus.PUBLISHED && value.gitTag && value.dvcPath;
      if (!publishable) throw new ConflictException('Only FROZEN dataset versions can be published');
      if (!value.manifestKey || !value.manifestChecksum) throw new ConflictException('Dataset version has no manifest');
      const content = await this.readObject(value.manifestKey);
      if (createHash('sha256').update(content).digest('hex') !== value.manifestChecksum) throw new ConflictException('Stored manifest checksum does not match the dataset version');
      return { version: value, manifest: content };
    });
    if (version.status === DatasetVersionStatus.PUBLISHED) {
      await runStep('Recovery Check', () => this.requireRemoteReachable());
      return version;
    }
    const workspacePath = join('data', 'dataset-workspace', this.workspaceName(version.dataset.name), String(version.version));
    const absoluteWorkspace = this.dvc.resolveWorkspace(workspacePath);
    await runStep('Workspace Snapshot', async () => {
      await mkdir(join(absoluteWorkspace, 'files'), { recursive: true });
      await writeFile(join(absoluteWorkspace, 'manifest.json'), manifest);
      for (const membership of version.files) {
        const robotFile = membership.robotFile;
        const content = await this.readObject(robotFile.objectKey);
        if (createHash('sha256').update(content).digest('hex') !== robotFile.checksum) throw new ConflictException(`Checksum mismatch for RobotFile ${robotFile.id}`);
        await writeFile(join(absoluteWorkspace, 'files', `${robotFile.id}${extname(robotFile.objectKey) || extname(robotFile.originalName)}`), content);
      }
      return { workspacePath };
    });
    const publication = await this.dvc.publish(workspacePath, version.dataset.name, version.version, runStep);
    // PUBLISHED is the acceptance state: never persist it until the remote is
    // demonstrably reachable. If this step fails, the version remains FROZEN and
    // a retry can safely reuse the idempotent DVC tag/commit.
    await runStep('Recovery Check', () => this.requireRemoteReachable());
    return runStep('Persist Version', () => this.prisma.datasetVersion.update({ where: { id }, data: { status: DatasetVersionStatus.PUBLISHED, ...publication } }));
  }

  async recoveryVerify(id: string, runStep: <T>(name: string, action: () => Promise<T>) => Promise<T> = (_name, action) => action()) {
    const version = await this.prisma.datasetVersion.findUnique({ where: { id }, include: { files: { include: { robotFile: true } } } });
    if (!version) throw new NotFoundException('Dataset version not found');
    if (version.status !== DatasetVersionStatus.PUBLISHED || !version.gitTag || !version.dvcPath || !version.manifestChecksum) throw new ConflictException('Only a fully published version can be recovery verified');
    return this.dvc.recoveryVerify(version.gitTag, version.dvcPath, async (workspaceRoot) => {
      await runStep('Verify Manifest and Files', async () => {
        const manifestPath = join(workspaceRoot, version.dvcPath!.replace(/\.dvc$/, ''), 'manifest.json');
        const manifest = await import('node:fs/promises').then((fs) => fs.readFile(manifestPath));
        if (createHash('sha256').update(manifest).digest('hex') !== version.manifestChecksum) throw new ConflictException('Recovered manifest checksum mismatch');
        const parsed = JSON.parse(manifest.toString('utf8')) as { files?: Array<{ fileId: string; checksum: string; fileSize: string }> };
        const expected = new Map(version.files.map((item) => [item.robotFileId, item.robotFile]));
        if (parsed.files?.length !== expected.size) throw new ConflictException('Recovered manifest membership mismatch');
        for (const item of parsed.files ?? []) { const file = expected.get(item.fileId); if (!file || file.checksum !== item.checksum || file.fileSize.toString() !== item.fileSize) throw new ConflictException(`Recovered member metadata mismatch for ${item.fileId}`); }
        return { files: expected.size };
      });
    }, runStep);
  }

  private async readObject(objectKey: string): Promise<Buffer> {
    const stream = await this.storage.getObject(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  private async requireRemoteReachable() {
    const health = await this.dvc.checkRemoteHealth();
    if (!health.configured || !health.reachable) throw new ConflictException('DVC remote is not reachable after publish');
    return health;
  }
  private workspaceName(name: string) { return basename(name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'dataset'); }
}
