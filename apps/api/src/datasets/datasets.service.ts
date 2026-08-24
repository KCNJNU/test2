import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatasetVersionStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { ListDatasetsQueryDto } from './dto/list-datasets-query.dto';
import { ListVersionFilesQueryDto } from './dto/list-version-files-query.dto';
import { ListVersionsQueryDto } from './dto/list-versions-query.dto';
import { AuthUser } from '../auth/auth.types';

type ManifestFile = { fileId: string; robotId: string; objectKey: string; checksum: string; fileSize: string; capturedAt: string };
type DatasetManifest = { datasetId: string; version: number; createdAt: string; files: ManifestFile[] };
type ValidationSeverity = 'error' | 'warning';
type ValidationIssue = { code: string; severity: ValidationSeverity; message: string; fileId?: string; objectKey?: string };

@Injectable()
export class DatasetsService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async create(input: CreateDatasetDto, scope?: AuthUser) {
    try {
      return await this.prisma.dataset.create({
        data: { name: input.name, description: input.description, metadata: input.metadata as Prisma.InputJsonValue | undefined, ...this.assignment(scope) },
      });
    }
    catch (error) { this.throwUniqueConflict(error, 'A dataset with this name already exists'); }
  }

  async get(id: string, scope?: AuthUser) {
    const dataset = await this.prisma.dataset.findFirst({ where: { id, ...this.datasetScope(scope) }, include: { versions: { orderBy: { version: 'desc' }, include: { files: { select: { robotFile: { select: { fileSize: true } } } } } } } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    return { ...dataset, versions: dataset.versions.map((version) => this.serializeVersionWithLiveStats(version)) };
  }

  async list(scope?: AuthUser) {
    const datasets = await this.prisma.dataset.findMany({ where: this.datasetScope(scope), include: { versions: { orderBy: { version: 'desc' }, include: { files: { select: { robotFile: { select: { fileSize: true } } } } } } }, orderBy: { createdAt: 'desc' } });
    return datasets.map((dataset) => ({ ...dataset, versions: dataset.versions.map((version) => this.serializeVersionWithLiveStats(version)) }));
  }

  async page(query: ListDatasetsQueryDto, scope?: AuthUser) {
    const search = query.search?.trim();
    const where: Prisma.DatasetWhereInput = {
      ...this.datasetScope(scope),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }),
      ...(query.status && { versions: { some: { status: query.status } } }),
      ...(query.tagId && { tags: { some: { tagId: query.tagId } } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataset.findMany({ where, orderBy: { [query.sortBy]: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { versions: { orderBy: { version: 'desc' }, include: { files: { select: { robotFile: { select: { fileSize: true } } } } } } } }),
      this.prisma.dataset.count({ where }),
    ]);
    return {
      items: items.map((dataset) => {
        const versions = dataset.versions.map((version) => this.serializeVersionWithLiveStats(version));
        return { ...dataset, versions, latestVersion: versions[0] ?? null, versionCount: versions.length };
      }),
      total, page: query.page, pageSize: query.pageSize,
    };
  }

  async pageVersions(query: ListVersionsQueryDto, scope?: AuthUser) {
    const search = query.search?.trim();
    const where: Prisma.DatasetVersionWhereInput = {
      datasetId: query.datasetId,
      status: query.status,
      dataset: this.datasetScope(scope),
      ...(search && { OR: [{ gitTag: { contains: search, mode: 'insensitive' } }, { gitCommit: { contains: search, mode: 'insensitive' } }, { dataset: { name: { contains: search, mode: 'insensitive' } } }] }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.datasetVersion.findMany({ where, orderBy: { [query.sortBy]: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { dataset: { select: { id: true, name: true } }, files: { select: { robotFile: { select: { fileSize: true } } } } } }),
      this.prisma.datasetVersion.count({ where }),
    ]);
    return { items: items.map((version) => this.serializeVersionWithLiveStats(version)), total, page: query.page, pageSize: query.pageSize };
  }

  async createVersion(datasetId: string, fileIds: string[], sourceVersionId?: string, scope?: AuthUser) {
    const dataset = scope ? await this.prisma.dataset.findFirst({ where: { id: datasetId, ...this.datasetScope(scope) }, select: { id: true } }) : await this.prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    if (sourceVersionId && fileIds.length) throw new BadRequestException('sourceVersionId and fileIds are mutually exclusive');
    let selectedFileIds = fileIds;
    if (sourceVersionId) {
      const source = await this.prisma.datasetVersion.findUnique({ where: { id: sourceVersionId }, select: { datasetId: true, files: { select: { robotFileId: true } } } });
      if (!source) throw new NotFoundException('Source dataset version not found');
      if (source.datasetId !== datasetId) throw new ConflictException('Source version must belong to the same dataset');
      selectedFileIds = source.files.map((file) => file.robotFileId);
    }
    await this.ensureFilesExist(selectedFileIds, scope);
    const latest = await this.prisma.datasetVersion.aggregate({ where: { datasetId }, _max: { version: true } });
    try {
      const version = await this.prisma.datasetVersion.create({ data: { datasetId, version: (latest._max.version ?? 0) + 1, files: { create: selectedFileIds.map((robotFileId) => ({ robotFileId })) } }, include: { files: { include: { robotFile: true } } } });
      return this.serializeDetailedVersion(version);
    } catch (error) { this.throwUniqueConflict(error, 'A version was created concurrently; retry the request'); }
  }

  async getVersion(id: string, scope?: AuthUser) { return this.serializeDetailedVersion(await this.findVersion(id, scope)); }

  async addFiles(versionId: string, fileIds: string[], scope?: AuthUser) {
    const version = await this.findVersion(versionId, scope);
    this.assertDraft(version.status);
    await this.ensureFilesExist(fileIds, scope);
    const existing = new Set(version.files.map((file) => file.robotFileId));
    const additions = fileIds.filter((fileId) => !existing.has(fileId));
    if (additions.length) await this.prisma.datasetVersionFile.createMany({ data: additions.map((robotFileId) => ({ datasetVersionId: versionId, robotFileId })), skipDuplicates: true });
    return this.getVersion(versionId, scope);
  }

  async replaceFiles(versionId: string, fileIds: string[], scope?: AuthUser) {
    const version = await this.findVersion(versionId, scope);
    this.assertDraft(version.status);
    await this.ensureFilesExist(fileIds, scope);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.datasetVersionFile.deleteMany({ where: { datasetVersionId: versionId } });
      if (fileIds.length) await transaction.datasetVersionFile.createMany({ data: fileIds.map((robotFileId) => ({ datasetVersionId: versionId, robotFileId })) });
    });
    return this.getVersion(versionId, scope);
  }

  async listVersionFiles(versionId: string, query: ListVersionFilesQueryDto, candidates = false, scope?: AuthUser) {
    const version = await this.prisma.datasetVersion.findFirst({ where: { id: versionId, dataset: this.datasetScope(scope) }, select: { id: true } });
    if (!version) throw new NotFoundException('Dataset version not found');
    const search = query.search?.trim();
    const where: Prisma.RobotFileWhereInput = {
      ...(candidates ? { datasetFiles: { none: { datasetVersionId: versionId } } } : { datasetFiles: { some: { datasetVersionId: versionId } } }),
      robot: this.robotScope(scope),
      robotId: query.robotId,
      recognitionType: query.recognitionType,
      schemaVersion: query.schemaVersion,
      capturedAt: { gte: query.startTime ? new Date(query.startTime) : undefined, lte: query.endTime ? new Date(query.endTime) : undefined },
      ...(search && { OR: [{ originalName: { contains: search, mode: 'insensitive' } }, { objectKey: { contains: search, mode: 'insensitive' } }, { checksum: { contains: search, mode: 'insensitive' } }] }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.robotFile.findMany({ where, orderBy: { [query.sortBy]: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { robot: { select: { id: true, name: true, externalId: true } } } }),
      this.prisma.robotFile.count({ where }),
    ]);
    return { items: items.map((file) => this.serializeFile(file)), total, page: query.page, pageSize: query.pageSize };
  }

  async removeFile(versionId: string, fileId: string, scope?: AuthUser): Promise<void> {
    const version = await this.findVersion(versionId, scope);
    this.assertDraft(version.status);
    const result = await this.prisma.datasetVersionFile.deleteMany({ where: { datasetVersionId: versionId, robotFileId: fileId } });
    if (!result.count) throw new NotFoundException('Robot file is not in this dataset version');
  }

  async freeze(id: string, scope?: AuthUser) {
    const version = await this.findVersion(id, scope);
    this.assertDraft(version.status);
    const validation = await this.validateVersion(id, scope);
    if (!validation.valid) throw new ConflictException({ message: 'Dataset version validation failed', validation });
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

  async validateVersion(id: string, scope?: AuthUser) {
    const version = await this.findVersion(id, scope);
    const issues: ValidationIssue[] = [];
    if (!version.files.length) issues.push({ code: 'EMPTY_VERSION', severity: 'error', message: 'Dataset version must contain at least one RobotFile' });
    let checkedObjects = 0;
    await this.mapWithConcurrency(version.files, 3, async ({ robotFile }) => {
      if (!/^[a-f0-9]{64}$/i.test(robotFile.checksum)) issues.push({ code: 'INVALID_CHECKSUM', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: 'RobotFile checksum is not a SHA-256 value' });
      if (robotFile.fileSize <= 0n) issues.push({ code: 'INVALID_SIZE', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: 'RobotFile size must be greater than zero' });
      const operationState: { phase: 'check' | 'read' } = { phase: 'check' };
      try {
        await this.withTimeout((async () => {
          if (!await this.storage.exists(robotFile.objectKey)) {
            issues.push({ code: 'OBJECT_MISSING', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: 'ObjectStorage object is not reachable' });
            return;
          }
          operationState.phase = 'read';
          const content = await this.readObject(robotFile.objectKey);
          checkedObjects += 1;
          if (BigInt(content.length) !== robotFile.fileSize) issues.push({ code: 'SIZE_MISMATCH', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: `Stored object size ${content.length} does not match metadata ${robotFile.fileSize.toString()}` });
          if (createHash('sha256').update(content).digest('hex') !== robotFile.checksum) issues.push({ code: 'CHECKSUM_MISMATCH', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: 'Stored object checksum does not match RobotFile metadata' });
        })(), robotFile.objectKey);
      } catch (error) {
        issues.push({ code: operationState.phase === 'read' ? 'OBJECT_READ_FAILED' : 'OBJECT_CHECK_FAILED', severity: 'error', fileId: robotFile.id, objectKey: robotFile.objectKey, message: error instanceof Error ? error.message : `ObjectStorage object could not be ${operationState.phase === 'read' ? 'read' : 'checked'}` });
      }
    });
    if (version.status !== DatasetVersionStatus.DRAFT) await this.validateManifest(version, issues);
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    return {
      versionId: version.id, status: version.status, valid: errors === 0, validatedAt: new Date().toISOString(),
      summary: { files: version.files.length, totalSize: version.files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n).toString(), checkedObjects, errors, warnings },
      issues,
    };
  }

  async compareVersions(datasetId: string, baseVersionId: string, targetVersionId: string, scope?: AuthUser) {
    const dataset = scope ? await this.prisma.dataset.findFirst({ where: { id: datasetId, ...this.datasetScope(scope) }, select: { id: true, name: true } }) : await this.prisma.dataset.findUnique({ where: { id: datasetId }, select: { id: true, name: true } });
    if (!dataset) throw new NotFoundException('Dataset not found');
    const versions = await this.prisma.datasetVersion.findMany({ where: { id: { in: [baseVersionId, targetVersionId] } }, include: { files: { include: { robotFile: { include: { robot: { select: { id: true, name: true, externalId: true } } } } } } } });
    const base = versions.find((version) => version.id === baseVersionId);
    const target = versions.find((version) => version.id === targetVersionId);
    if (!base || !target) throw new NotFoundException('One or more dataset versions were not found');
    if (base.datasetId !== datasetId || target.datasetId !== datasetId) throw new ConflictException('Both versions must belong to the requested dataset');
    const baseMap = new Map(base.files.map((membership) => [membership.robotFileId, membership.robotFile]));
    const targetMap = new Map(target.files.map((membership) => [membership.robotFileId, membership.robotFile]));
    const added = [...targetMap].filter(([id]) => !baseMap.has(id)).map(([, file]) => this.serializeCompareFile(file));
    const removed = [...baseMap].filter(([id]) => !targetMap.has(id)).map(([, file]) => this.serializeCompareFile(file));
    const unchanged = [...targetMap].filter(([id]) => baseMap.has(id)).map(([, file]) => this.serializeCompareFile(file));
    const baseSize = base.files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n);
    const targetSize = target.files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n);
    const sort = <T extends { originalName: string }>(items: T[]) => items.sort((a, b) => a.originalName.localeCompare(b.originalName));
    return {
      dataset,
      base: { id: base.id, version: base.version, status: base.status, fileCount: base.files.length, totalSize: baseSize.toString() },
      target: { id: target.id, version: target.version, status: target.status, fileCount: target.files.length, totalSize: targetSize.toString() },
      summary: { added: added.length, removed: removed.length, unchanged: unchanged.length, totalSizeDelta: (targetSize - baseSize).toString() },
      files: { added: sort(added), removed: sort(removed), unchanged: sort(unchanged) },
    };
  }

  private async findVersion(id: string, scope?: AuthUser) {
    const include = { dataset: { select: { id: true, tenantId: true, projectId: true } }, files: { include: { robotFile: { include: { robot: { select: { id: true, name: true, externalId: true } } } } }, orderBy: { robotFileId: 'asc' as const } } };
    const version = scope ? await this.prisma.datasetVersion.findFirst({ where: { id, dataset: this.datasetScope(scope) }, include }) : await this.prisma.datasetVersion.findUnique({ where: { id }, include });
    if (!version) throw new NotFoundException('Dataset version not found');
    return { ...version, dataset: version.dataset ?? { id: version.datasetId, tenantId: null, projectId: null } };
  }

  private async ensureFilesExist(fileIds: string[], scope?: AuthUser) {
    if (!fileIds.length) return;
    const count = await this.prisma.robotFile.count({ where: { id: { in: fileIds }, robot: this.robotScope(scope) } });
    if (count !== fileIds.length) throw new NotFoundException('One or more robot files were not found');
  }

  private datasetScope(scope?: AuthUser): Prisma.DatasetWhereInput { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; return { tenantId: scope.tenantId ?? '__NO_TENANT__', ...(scope.role === 'TENANT_ADMIN' ? {} : { projectId: { in: scope.projectIds } }) }; }
  private robotScope(scope?: AuthUser): Prisma.RobotWhereInput { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; return { tenantId: scope.tenantId ?? '__NO_TENANT__', ...(scope.role === 'TENANT_ADMIN' ? {} : { projectId: { in: scope.projectIds } }) }; }
  private assignment(scope?: AuthUser) { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; if (!scope.tenantId) throw new BadRequestException('Authenticated user has no tenant'); if (scope.projectIds.length !== 1) throw new BadRequestException('Exactly one project assignment is required to create a dataset'); return { tenantId: scope.tenantId, projectId: scope.projectIds[0] }; }

  private async validateManifest(version: Awaited<ReturnType<DatasetsService['findVersion']>>, issues: ValidationIssue[]) {
    if (!version.manifestKey || !version.manifestChecksum) {
      issues.push({ code: 'MANIFEST_MISSING', severity: 'error', message: 'Frozen or published version has no manifest reference' });
      return;
    }
    let manifestExists = false;
    try { manifestExists = await this.withTimeout(this.storage.exists(version.manifestKey), version.manifestKey); }
    catch (error) { issues.push({ code: 'MANIFEST_CHECK_FAILED', severity: 'error', objectKey: version.manifestKey, message: error instanceof Error ? error.message : 'Manifest could not be checked' }); return; }
    if (!manifestExists) {
      issues.push({ code: 'MANIFEST_OBJECT_MISSING', severity: 'error', objectKey: version.manifestKey, message: 'Manifest object is not reachable' });
      return;
    }
    try {
      const content = await this.readObjectWithTimeout(version.manifestKey);
      if (createHash('sha256').update(content).digest('hex') !== version.manifestChecksum) issues.push({ code: 'MANIFEST_CHECKSUM_MISMATCH', severity: 'error', objectKey: version.manifestKey, message: 'Manifest checksum does not match the frozen version' });
      const manifest = JSON.parse(content.toString('utf8')) as Partial<DatasetManifest>;
      const actualIds = new Set((manifest.files ?? []).map((file) => file.fileId));
      const expectedIds = new Set(version.files.map((file) => file.robotFileId));
      if (actualIds.size !== expectedIds.size || [...expectedIds].some((id) => !actualIds.has(id))) issues.push({ code: 'MANIFEST_MEMBERSHIP_MISMATCH', severity: 'error', objectKey: version.manifestKey, message: 'Manifest membership does not match the database version' });
      const liveSize = version.files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n);
      if (version.fileCount !== version.files.length || version.totalSize !== liveSize) issues.push({ code: 'VERSION_AGGREGATE_MISMATCH', severity: 'error', message: 'Persisted version aggregates do not match its membership' });
    } catch (error) {
      issues.push({ code: 'MANIFEST_READ_FAILED', severity: 'error', objectKey: version.manifestKey, message: error instanceof Error ? error.message : 'Manifest could not be read' });
    }
  }

  private async readObjectWithTimeout(objectKey: string) {
    return this.withTimeout(this.readObject(objectKey), objectKey);
  }

  private async readObject(objectKey: string) {
    const stream = await this.storage.getObject(objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  private async withTimeout<T>(operation: Promise<T>, objectKey: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try { return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`ObjectStorage check timed out for ${objectKey}`)), 15_000); })]); }
    finally { if (timer) clearTimeout(timer); }
  }

  private async mapWithConcurrency<T>(items: T[], concurrency: number, action: (item: T) => Promise<void>) {
    let cursor = 0;
    const worker = async () => { while (cursor < items.length) { const item = items[cursor++]; await action(item); } };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  }

  private assertDraft(status: DatasetVersionStatus) { if (status !== DatasetVersionStatus.DRAFT) throw new ConflictException('Frozen dataset versions cannot be modified; create a new version instead'); }
  private createManifest(version: Awaited<ReturnType<DatasetsService['findVersion']>>): DatasetManifest {
    return { datasetId: version.datasetId, version: version.version, createdAt: version.createdAt.toISOString(), files: version.files.map(({ robotFile }) => ({ fileId: robotFile.id, robotId: robotFile.robotId, objectKey: robotFile.objectKey, checksum: robotFile.checksum, fileSize: robotFile.fileSize.toString(), capturedAt: robotFile.capturedAt.toISOString() })) };
  }
  private serializeVersion<T extends { totalSize: bigint; files?: Array<{ robotFile?: { fileSize: bigint } }> }>(value: T) {
    const serializedFiles = value.files?.map((membership) => membership.robotFile ? { ...membership, robotFile: this.serializeFile(membership.robotFile) } : membership);
    return { ...value, totalSize: value.totalSize.toString(), ...(serializedFiles && { files: serializedFiles }) };
  }
  private serializeVersionWithLiveStats<T extends { totalSize: bigint; files: Array<{ robotFile: { fileSize: bigint } }> }>(value: T) {
    const { files, ...version } = value;
    const fileCount = files.length; const totalSize = files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n).toString();
    return { ...version, fileCount, totalSize };
  }
  private serializeDetailedVersion<T extends { status: DatasetVersionStatus; fileCount: number; totalSize: bigint; files: Array<{ robotFile: { fileSize: bigint } }> }>(value: T) {
    const serialized = this.serializeVersion(value);
    if (value.status !== DatasetVersionStatus.DRAFT) return serialized;
    return { ...serialized, fileCount: value.files.length, totalSize: value.files.reduce((sum, item) => sum + item.robotFile.fileSize, 0n).toString() };
  }
  private serializeFile<T extends { fileSize: bigint }>(value: T): Omit<T, 'fileSize'> & { fileSize: string } { return { ...value, fileSize: value.fileSize.toString() }; }
  private serializeCompareFile<T extends { fileSize: bigint; id: string; originalName: string; checksum: string; recognitionType: string; schemaVersion: string; capturedAt: Date; robot: unknown }>(file: T) { return { id: file.id, originalName: file.originalName, checksum: file.checksum, recognitionType: file.recognitionType, schemaVersion: file.schemaVersion, capturedAt: file.capturedAt.toISOString(), fileSize: file.fileSize.toString(), robot: file.robot }; }
  private throwUniqueConflict(error: unknown, message: string): never { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message); throw error; }
}
