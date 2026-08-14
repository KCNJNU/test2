import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetVersionStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { CreateDatasetDto } from './dto/create-dataset.dto';

type ManifestFile = { fileId: string; robotId: string; objectKey: string; checksum: string; fileSize: string; capturedAt: string };
type DatasetManifest = { datasetId: string; version: number; createdAt: string; files: ManifestFile[] };

@Injectable()
export class DatasetsService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async create(input: CreateDatasetDto) {
    try {
      return await this.prisma.dataset.create({
        data: { name: input.name, description: input.description, metadata: input.metadata as Prisma.InputJsonValue | undefined },
      });
    }
    catch (error) { this.throwUniqueConflict(error, 'A dataset with this name already exists'); }
  }

  async get(id: string) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' } } } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return this.serializeDataset(dataset);
  }

  async list() {
    const datasets = await this.prisma.dataset.findMany({ include: { versions: { orderBy: { version: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    return datasets.map((dataset) => this.serializeDataset(dataset));
  }

  async createVersion(datasetId: string, fileIds: string[]) {
    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    await this.ensureFilesExist(fileIds);
    const latest = await this.prisma.datasetVersion.aggregate({ where: { datasetId }, _max: { version: true } });
    try {
      const version = await this.prisma.datasetVersion.create({ data: { datasetId, version: (latest._max.version ?? 0) + 1, files: { create: fileIds.map((robotFileId) => ({ robotFileId })) } }, include: { files: { include: { robotFile: true } } } });
      return this.serializeVersion(version);
    } catch (error) { this.throwUniqueConflict(error, 'A version was created concurrently; retry the request'); }
  }

  async getVersion(id: string) { return this.serializeVersion(await this.findVersion(id)); }

  async addFiles(versionId: string, fileIds: string[]) {
    const version = await this.findVersion(versionId);
    this.assertDraft(version.status);
    await this.ensureFilesExist(fileIds);
    const existing = new Set(version.files.map((file) => file.robotFileId));
    const additions = fileIds.filter((fileId) => !existing.has(fileId));
    if (additions.length) await this.prisma.datasetVersionFile.createMany({ data: additions.map((robotFileId) => ({ datasetVersionId: versionId, robotFileId })), skipDuplicates: true });
    return this.getVersion(versionId);
  }

  async removeFile(versionId: string, fileId: string): Promise<void> {
    const version = await this.findVersion(versionId);
    this.assertDraft(version.status);
    const result = await this.prisma.datasetVersionFile.deleteMany({ where: { datasetVersionId: versionId, robotFileId: fileId } });
    if (!result.count) throw new NotFoundException('Robot file is not in this dataset version');
  }

  async freeze(id: string) {
    const version = await this.findVersion(id);
    this.assertDraft(version.status);
    const manifest = this.createManifest(version);
    const content = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    const manifestChecksum = createHash('sha256').update(content).digest('hex');
    const manifestKey = `manifests/${version.datasetId}/v${version.version}/manifest.json`;
    await this.storage.putObject({ objectKey: manifestKey, content, contentType: 'application/json' });
    try {
      const frozen = await this.prisma.datasetVersion.update({ where: { id }, data: { status: DatasetVersionStatus.FROZEN, frozenAt: new Date(), manifestKey, manifestChecksum, fileCount: version.files.length, totalSize: version.files.reduce((sum, item) => sum + item.robotFile.fileSize, BigInt(0)) }, include: { files: { include: { robotFile: true } } } });
      return this.serializeVersion(frozen);
    } catch (error) {
      await this.storage.deleteObject(manifestKey).catch(() => undefined);
      throw error;
    }
  }

  private async findVersion(id: string) {
    const version = await this.prisma.datasetVersion.findUnique({ where: { id }, include: { files: { include: { robotFile: true }, orderBy: { robotFileId: 'asc' } } } });
    if (!version) throw new NotFoundException('Dataset version not found');
    return version;
  }

  private async ensureFilesExist(fileIds: string[]) {
    if (!fileIds.length) return;
    const count = await this.prisma.robotFile.count({ where: { id: { in: fileIds } } });
    if (count !== fileIds.length) throw new NotFoundException('One or more robot files were not found');
  }

  private assertDraft(status: DatasetVersionStatus) { if (status !== DatasetVersionStatus.DRAFT) throw new ConflictException('Frozen dataset versions cannot be modified; create a new version instead'); }
  private createManifest(version: Awaited<ReturnType<DatasetsService['findVersion']>>): DatasetManifest {
    return { datasetId: version.datasetId, version: version.version, createdAt: version.createdAt.toISOString(), files: version.files.map(({ robotFile }) => ({ fileId: robotFile.id, robotId: robotFile.robotId, objectKey: robotFile.objectKey, checksum: robotFile.checksum, fileSize: robotFile.fileSize.toString(), capturedAt: robotFile.capturedAt.toISOString() })) };
  }
  private serializeVersion<T extends { totalSize: bigint; files?: unknown[] }>(value: T): Omit<T, 'totalSize'> & { totalSize: string } { return { ...value, totalSize: value.totalSize.toString() }; }
  private serializeDataset<T extends { versions: Array<{ totalSize: bigint }> }>(value: T) { return { ...value, versions: value.versions.map((version) => this.serializeVersion(version)) }; }
  private throwUniqueConflict(error: unknown, message: string): never { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message); throw error; }
}
