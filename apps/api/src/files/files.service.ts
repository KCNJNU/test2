import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { UploadedFile } from './uploaded-file';
import { SettingsService } from '../settings/settings.service';
import { AuthUser } from '../auth/auth.types';

const JSON_MIME_TYPES = new Set(['application/json', 'text/json']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage, @Optional() private readonly settings?: SettingsService) {}

  async create(input: { robotId: string; recognitionType: string; capturedAt: string; schemaVersion: string; metadata?: string; file: UploadedFile }, scope?: AuthUser) {
    const { file } = input;
    if (!file || file.size === 0 || file.size > MAX_FILE_SIZE) throw new ConflictException('File size must be between 1 byte and 10 MiB');
    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.json' || !JSON_MIME_TYPES.has(file.mimetype)) throw new ConflictException('Only JSON files are supported in phase 1');
    try { JSON.parse(file.buffer.toString('utf8')); } catch { throw new ConflictException('The JSON file cannot be parsed'); }
    const robot = await this.prisma.robot.findFirst({ where: { id: input.robotId, ...this.robotScope(scope) }, select: { id: true, externalId: true } });
    if (!robot) throw new NotFoundException('Robot not found');
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    if (await this.prisma.robotFile.findUnique({ where: { checksum }, select: { id: true } })) throw new ConflictException('A file with this checksum already exists');
    const capturedAt = new Date(input.capturedAt);
    if (Number.isNaN(capturedAt.valueOf())) throw new ConflictException('capturedAt must be a valid date');
    let metadata: Prisma.InputJsonValue | undefined;
    if (input.metadata) {
      try {
        const parsed: unknown = JSON.parse(input.metadata);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('not an object');
        metadata = parsed as Prisma.InputJsonObject;
      } catch { throw new BadRequestException('metadata must be a valid JSON object'); }
    }
    const robotCode = robot.externalId ?? robot.id;
    const uuid = randomUUID();
    const objectKey = `raw/${robotCode}/${capturedAt.getUTCFullYear()}/${String(capturedAt.getUTCMonth() + 1).padStart(2, '0')}/${String(capturedAt.getUTCDate()).padStart(2, '0')}/${uuid}${extension}`;
    await this.storage.putObject({ objectKey, content: file.buffer, contentType: file.mimetype });
    try {
      return this.serialize(await this.prisma.robotFile.create({ data: { robotId: robot.id, objectKey, originalName: file.originalname, fileType: 'json', mimeType: file.mimetype, fileSize: BigInt(file.size), checksum, recognitionType: input.recognitionType, schemaVersion: input.schemaVersion, capturedAt, metadata } }));
    } catch (error: unknown) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async list(query: ListFilesQueryDto, scope?: AuthUser) {
    const search = query.search?.trim();
    const where: Prisma.RobotFileWhereInput = {
      robotId: query.robotId,
      robot: this.robotScope(scope),
      fileType: query.fileType,
      recognitionType: query.recognitionType,
      schemaVersion: query.schemaVersion,
      checksum: query.checksum,
      ...(query.tagId && { tags: { some: { tagId: query.tagId } } }),
      ...(search && { OR: [{ originalName: { contains: search, mode: 'insensitive' } }, { objectKey: { contains: search, mode: 'insensitive' } }, { checksum: { contains: search, mode: 'insensitive' } }] }),
      capturedAt: { gte: query.startTime ? new Date(query.startTime) : undefined, lte: query.endTime ? new Date(query.endTime) : undefined },
      createdAt: { gte: query.uploadedStartTime ? new Date(query.uploadedStartTime) : undefined, lte: query.uploadedEndTime ? new Date(query.uploadedEndTime) : undefined },
      fileSize: { gte: query.minSize === undefined ? undefined : BigInt(query.minSize), lte: query.maxSize === undefined ? undefined : BigInt(query.maxSize) },
    };
    const [items, total] = await this.prisma.$transaction([this.prisma.robotFile.findMany({ where, select: { id: true, robotId: true, objectKey: true, originalName: true, fileType: true, mimeType: true, fileSize: true, checksum: true, recognitionType: true, schemaVersion: true, capturedAt: true, createdAt: true, updatedAt: true, robot: { select: { id: true, name: true, externalId: true } }, tags: { include: { tag: true } } }, orderBy: { [query.sortBy]: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.robotFile.count({ where })]);
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string, scope?: AuthUser) {
    const item = await this.prisma.robotFile.findFirst({ where: { id, robot: this.robotScope(scope) }, include: { robot: { select: { id: true, name: true, externalId: true } }, tags: { include: { tag: true } }, datasetFiles: { include: { datasetVersion: { include: { dataset: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' } } } });
    if (!item) throw new NotFoundException('Robot file not found');
    return this.serialize(item);
  }
  async getDownloadUrl(id: string, scope?: AuthUser) { const item = await this.find(id, scope); if (!(await this.storage.exists(item.objectKey))) throw new NotFoundException('Stored object not found'); const ttl = this.settings ? await this.settings.get('download.presignedTtlSeconds') : 900; return { url: await this.storage.getPresignedDownloadUrl(item.objectKey, ttl) }; }
  async delete(id: string, scope?: AuthUser): Promise<void> {
    const item = await this.find(id, scope);
    const references = await this.prisma.datasetVersionFile.count({ where: { robotFileId: id } });
    if (references) throw new ConflictException('Robot file is referenced by a dataset version and cannot be deleted');
    try {
      // The foreign key is the final concurrency guard. Remove metadata first so a
      // racing dataset reference can never leave a live row pointing at a missing object.
      await this.prisma.robotFile.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('Robot file is referenced by a dataset version and cannot be deleted');
      }
      throw error;
    }
    // A storage failure leaves a recoverable orphan object which reconciliation can
    // remove; it does not destroy data still referenced by PostgreSQL.
    await this.storage.deleteObject(item.objectKey);
  }

  private async find(id: string, scope?: AuthUser) { const item = await this.prisma.robotFile.findFirst({ where: { id, robot: this.robotScope(scope) } }); if (!item) throw new NotFoundException('Robot file not found'); return item; }
  private robotScope(scope?: AuthUser): Prisma.RobotWhereInput { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; return { tenantId: scope.tenantId ?? '__NO_TENANT__', ...(scope.role === 'TENANT_ADMIN' ? {} : { projectId: { in: scope.projectIds } }) }; }
  private serialize<T extends { fileSize: bigint }>(item: T): Omit<T, 'fileSize'> & { fileSize: string } { return { ...item, fileSize: item.fileSize.toString() }; }
}
