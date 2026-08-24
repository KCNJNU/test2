import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, JobType, Prisma, UploadStatus, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { AuthUser } from '../auth/auth.types';

export const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const EXTENSION_KIND = new Map([
  ['.json', 'json'], ['.jpg', 'image'], ['.jpeg', 'image'], ['.png', 'image'], ['.pcd', 'pcd'],
  ['.pgm', 'map'], ['.yaml', 'yaml'], ['.yml', 'yaml'], ['.log', 'log'], ['.txt', 'log'],
]);
const LIMIT_KEYS = { json: 'upload.jsonMaxBytes', image: 'upload.imageMaxBytes', pcd: 'upload.pcdMaxBytes', map: 'upload.mapMaxBytes', yaml: 'upload.yamlMaxBytes', log: 'upload.logMaxBytes' } as const;

type CreateUploadInput = { robotId: string; originalName: string; mimeType: string; fileSize: number; checksum: string; recognitionType: string; schemaVersion: string; capturedAt: string; metadata?: Record<string, unknown>; lastModified?: number };

@Injectable()
export class UploadsService {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, private readonly settings: SettingsService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async create(owner: string | AuthUser, input: CreateUploadInput) {
    const ownerId=typeof owner==='string'?owner:owner.id;
    const extension = extname(input.originalName).toLowerCase();
    const kind = EXTENSION_KIND.get(extension);
    if (!kind) throw new BadRequestException('Unsupported upload file extension');
    if (!/^[a-f0-9]{64}$/i.test(input.checksum)) throw new BadRequestException('checksum must be SHA-256');
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > MAX_UPLOAD_BYTES) throw new BadRequestException('fileSize must be between 1 byte and 2 GiB');
    const maxFileSize = BigInt(await this.settings.get(LIMIT_KEYS[kind as keyof typeof LIMIT_KEYS]));
    if (BigInt(input.fileSize) > maxFileSize) throw new ConflictException(`File exceeds the configured ${kind} size limit`);
    const capturedAt = new Date(input.capturedAt);
    if (Number.isNaN(capturedAt.valueOf())) throw new BadRequestException('capturedAt must be a valid date');
    const robotScope: Prisma.RobotWhereInput=typeof owner==='string'||owner.role===UserRole.ADMIN||owner.role===UserRole.SUPER_ADMIN?{}:{tenantId:owner.tenantId??'__NO_TENANT__',...(owner.role===UserRole.TENANT_ADMIN?{}:{projectId:{in:owner.projectIds}})};
    const [robot, duplicate] = await Promise.all([this.prisma.robot.findFirst({ where: { id: input.robotId, ...robotScope }, select: { id: true } }), this.prisma.robotFile.findUnique({ where: { checksum: input.checksum }, select: { id: true } })]);
    if (!robot) throw new NotFoundException('Robot not found');
    if (duplicate) throw new ConflictException({ message: 'A file with this checksum already exists', robotFileId: duplicate.id });
    const id = randomUUID();
    const totalParts = Math.ceil(input.fileSize / UPLOAD_CHUNK_SIZE);
    return this.serialize(await this.prisma.uploadSession.create({ data: { id, ownerId, robotId: input.robotId, originalName: input.originalName, fileType: kind, mimeType: input.mimeType, fileSize: BigInt(input.fileSize), checksum: input.checksum.toLowerCase(), recognitionType: input.recognitionType, schemaVersion: input.schemaVersion, capturedAt, metadata: input.metadata as Prisma.InputJsonObject | undefined, chunkSize: UPLOAD_CHUNK_SIZE, totalParts, maxFileSize, tempPrefix: `uploads/${id}/parts/`, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, include: { parts: true } }));
  }

  async get(id: string, userId: string, role: UserRole) { const session = await this.find(id); this.assertOwner(session.ownerId, userId, role); return this.serialize(session); }

  async putPart(id: string, partNumber: number, contentRange: string | undefined, partChecksum: string | undefined, content: Buffer, userId: string, role: UserRole) {
    const session = await this.find(id); this.assertOwner(session.ownerId, userId, role); this.assertWritable(session.status, session.expiresAt);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.totalParts) throw new BadRequestException('partNumber is outside the upload range');
    if (!partChecksum || !/^[a-f0-9]{64}$/i.test(partChecksum)) throw new BadRequestException('X-Part-SHA256 is required');
    const expectedStart = (partNumber - 1) * session.chunkSize;
    const expectedEnd = Math.min(Number(session.fileSize), expectedStart + session.chunkSize) - 1;
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange ?? '');
    if (!match || Number(match[1]) !== expectedStart || Number(match[2]) !== expectedEnd || BigInt(match[3]) !== session.fileSize || content.length !== expectedEnd - expectedStart + 1) throw new BadRequestException('Content-Range does not match this part');
    const actual = createHash('sha256').update(content).digest('hex');
    if (actual !== partChecksum.toLowerCase()) throw new ConflictException('Part checksum mismatch');
    const objectKey = `${session.tempPrefix}${String(partNumber).padStart(6, '0')}`;
    const existing = session.parts.find((part) => part.partNumber === partNumber);
    if (existing?.checksum === actual && existing.size === content.length && await this.storage.exists(existing.objectKey)) return existing;
    await this.storage.putObject({ objectKey, content, contentType: 'application/octet-stream' });
    const part = await this.prisma.uploadPart.upsert({ where: { uploadSessionId_partNumber: { uploadSessionId: id, partNumber } }, update: { objectKey, size: content.length, checksum: actual }, create: { uploadSessionId: id, partNumber, objectKey, size: content.length, checksum: actual } });
    await this.prisma.uploadSession.update({ where: { id }, data: { status: UploadStatus.UPLOADING } });
    return part;
  }

  async complete(id: string, userId: string, role: UserRole) {
    const session = await this.find(id); this.assertOwner(session.ownerId, userId, role);
    if (session.status === UploadStatus.COMPLETED && session.robotFileId) return { completed: true, robotFileId: session.robotFileId };
    const existing = await this.prisma.job.findFirst({ where: { type: JobType.UPLOAD_FINALIZE, resourceId: id, status: { in: [JobStatus.QUEUED, JobStatus.RUNNING] } }, include: { steps: true } });
    if (existing) return existing;
    this.assertWritable(session.status, session.expiresAt);
    if (session.parts.length !== session.totalParts) throw new ConflictException('All parts must be uploaded before completion');
    await this.prisma.uploadSession.update({ where: { id }, data: { status: UploadStatus.FINALIZING } });
    const robot=await this.prisma.robot.findUniqueOrThrow({where:{id:session.robotId},select:{tenantId:true,projectId:true}});
    return this.jobs.create(JobType.UPLOAD_FINALIZE, { payload: { uploadSessionId: id }, resourceType: 'UploadSession', resourceId: id, requestedById: userId, tenantId: robot.tenantId, projectId: robot.projectId, maxAttempts: 3 });
  }

  async abort(id: string, userId: string, role: UserRole) {
    const session = await this.find(id); this.assertOwner(session.ownerId, userId, role);
    if (session.status === UploadStatus.COMPLETED) throw new ConflictException('Completed uploads cannot be aborted');
    await this.storage.deleteObjects(session.parts.map((part) => part.objectKey));
    await this.prisma.uploadSession.update({ where: { id }, data: { status: UploadStatus.ABORTED, errorMessage: null } });
  }

  async finalize(id: string) {
    const session = await this.find(id);
    if (session.status === UploadStatus.COMPLETED && session.robotFileId) return { robotFileId: session.robotFileId, uploadSessionId: id };
    if (session.parts.length !== session.totalParts) throw new ConflictException('Upload is missing one or more parts');
    const ordered = [...session.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (ordered.reduce((sum, item) => sum + BigInt(item.size), 0n) !== session.fileSize) throw new ConflictException('Uploaded parts do not match declared file size');
    const robot = await this.prisma.robot.findUniqueOrThrow({ where: { id: session.robotId }, select: { externalId: true } });
    const extension = extname(session.originalName).toLowerCase();
    const date = session.capturedAt;
    const finalObjectKey = session.finalObjectKey ?? `raw/${robot.externalId ?? session.robotId}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${randomUUID()}${extension}`;
    await this.prisma.uploadSession.update({ where: { id }, data: { finalObjectKey } });
    await this.storage.composeObject(finalObjectKey, ordered.map((part) => part.objectKey), session.mimeType);
    try {
      const inspection = await this.inspectObject(finalObjectKey, session.fileType);
      if (inspection.size !== session.fileSize) throw new ConflictException('Composed object size mismatch');
      if (inspection.checksum !== session.checksum) throw new ConflictException('Complete file checksum mismatch');
      const duplicate = await this.prisma.robotFile.findUnique({ where: { checksum: session.checksum }, select: { id: true } });
      if (duplicate) {
        await this.storage.deleteObject(finalObjectKey);
        await this.prisma.uploadSession.update({ where: { id }, data: { status: UploadStatus.COMPLETED, robotFileId: duplicate.id, completedAt: new Date(), errorMessage: null } });
        await this.cleanupParts(session.parts.map((part) => part.objectKey));
        return { robotFileId: duplicate.id, uploadSessionId: id, duplicate: true };
      }
      const file = await this.prisma.$transaction(async (tx) => {
        const created = await tx.robotFile.create({ data: { robotId: session.robotId, objectKey: finalObjectKey, originalName: session.originalName, fileType: session.fileType, mimeType: session.mimeType, fileSize: session.fileSize, checksum: session.checksum, recognitionType: session.recognitionType, schemaVersion: session.schemaVersion, capturedAt: session.capturedAt, metadata: session.metadata === null ? undefined : session.metadata as Prisma.InputJsonValue } });
        await tx.uploadSession.update({ where: { id }, data: { status: UploadStatus.COMPLETED, robotFileId: created.id, completedAt: new Date(), errorMessage: null } });
        return created;
      });
      await this.cleanupParts(session.parts.map((part) => part.objectKey));
      return { robotFileId: file.id, uploadSessionId: id, objectKey: finalObjectKey };
    } catch (error) {
      await this.storage.deleteObject(finalObjectKey).catch(() => undefined);
      await this.prisma.uploadSession.update({ where: { id }, data: { status: UploadStatus.FAILED, errorMessage: error instanceof Error ? error.message : 'Upload finalization failed' } }).catch(() => undefined);
      throw error;
    }
  }

  private async inspectObject(objectKey: string, kind: string) {
    const stream = await this.storage.getObject(objectKey); const hash = createHash('sha256'); let size = 0n; const prefix: Buffer[] = []; const document: Buffer[] = [];
    for await (const raw of stream) { const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw); hash.update(chunk); size += BigInt(chunk.length); if (Buffer.concat(prefix).length < 64 * 1024) prefix.push(chunk.subarray(0, 64 * 1024)); if (kind === 'json' || kind === 'yaml') document.push(chunk); }
    const header = Buffer.concat(prefix).subarray(0, 64 * 1024); this.validateFormat(kind, header, document.length ? Buffer.concat(document) : undefined);
    return { checksum: hash.digest('hex'), size };
  }

  private validateFormat(kind: string, header: Buffer, full?: Buffer) {
    if (!header.length) throw new ConflictException('File must not be empty');
    if (kind === 'json') { try { JSON.parse((full ?? header).toString('utf8')); } catch { throw new ConflictException('JSON is invalid'); } }
    if (kind === 'yaml') { try { const parsed: unknown = parseYaml((full ?? header).toString('utf8')); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(); } catch { throw new ConflictException('YAML must contain a mapping'); } }
    if (kind === 'image' && !(header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))) throw new ConflictException('Image magic bytes are invalid');
    if (kind === 'pcd' && !/(^|\n)(VERSION|FIELDS|DATA)\s+/m.test(header.toString('ascii'))) throw new ConflictException('PCD header is invalid');
    if (kind === 'map' && !/^P[25]\s/.test(header.toString('ascii'))) throw new ConflictException('PGM header must be P2 or P5');
  }

  private async cleanupParts(keys: string[]) { await this.storage.deleteObjects(keys).catch(() => undefined); }
  private async find(id: string) { const session = await this.prisma.uploadSession.findUnique({ where: { id }, include: { parts: true } }); if (!session) throw new NotFoundException('Upload session not found'); return session; }
  private assertOwner(ownerId: string, userId: string, role: UserRole) { if (ownerId !== userId && role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) throw new ForbiddenException('Upload session belongs to another user'); }
  private assertWritable(status: UploadStatus, expiresAt: Date) { if (expiresAt <= new Date()) throw new ConflictException('Upload session has expired'); if (status !== UploadStatus.CREATED && status !== UploadStatus.UPLOADING && status !== UploadStatus.FAILED) throw new ConflictException(`Upload session is ${status.toLowerCase()}`); }
  private serialize<T extends { fileSize: bigint; maxFileSize: bigint }>(value: T) { return { ...value, fileSize: value.fileSize.toString(), maxFileSize: value.maxFileSize.toString() }; }
}
