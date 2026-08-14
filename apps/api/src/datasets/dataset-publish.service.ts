import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { DvcService } from '../dvc/dvc.service';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';

@Injectable()
export class DatasetPublishService {
  private readonly repositoryRoot = resolve(__dirname, '..', '..', '..', '..');
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage, private readonly dvc: DvcService) {}

  async publish(id: string) {
    const version = await this.prisma.datasetVersion.findUnique({ where: { id }, include: { dataset: true, files: { include: { robotFile: true }, orderBy: { robotFileId: 'asc' } } } });
    if (!version) throw new NotFoundException('Dataset version not found');
    if (version.status !== DatasetVersionStatus.FROZEN) throw new ConflictException('Only FROZEN dataset versions can be published');
    if (!version.manifestKey || !version.manifestChecksum) throw new ConflictException('Frozen dataset version has no manifest');

    const manifest = await this.readObject(version.manifestKey);
    if (createHash('sha256').update(manifest).digest('hex') !== version.manifestChecksum) throw new ConflictException('Stored manifest checksum does not match the frozen dataset version');
    const workspacePath = join('data', 'dataset-workspace', this.workspaceName(version.dataset.name), String(version.version));
    const absoluteWorkspace = resolve(this.repositoryRoot, workspacePath);
    await mkdir(join(absoluteWorkspace, 'files'), { recursive: true });
    await writeFile(join(absoluteWorkspace, 'manifest.json'), manifest);
    for (const membership of version.files) {
      const robotFile = membership.robotFile;
      const content = await this.readObject(robotFile.objectKey);
      if (createHash('sha256').update(content).digest('hex') !== robotFile.checksum) throw new ConflictException(`Checksum mismatch for RobotFile ${robotFile.id}`);
      await writeFile(join(absoluteWorkspace, 'files', `${robotFile.id}${extname(robotFile.objectKey) || extname(robotFile.originalName)}`), content);
    }
    const publication = await this.dvc.publish(workspacePath, version.dataset.name, version.version);
    return this.prisma.datasetVersion.update({ where: { id }, data: { status: DatasetVersionStatus.PUBLISHED, ...publication } });
  }

  private async readObject(objectKey: string): Promise<Buffer> {
    const stream = await this.storage.getObject(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  private workspaceName(name: string) { return basename(name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'dataset'); }
}
