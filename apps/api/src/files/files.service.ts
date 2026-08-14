import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { UploadedFile } from './uploaded-file';

const JSON_MIME_TYPES = new Set(['application/json', 'text/json']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async create(input: { robotId: string; recognitionType: string; capturedAt: string; schemaVersion: string; file: UploadedFile }) {
    const { file } = input;
    if (!file || file.size === 0 || file.size > MAX_FILE_SIZE) throw new ConflictException('File size must be between 1 byte and 10 MiB');
    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.json' || !JSON_MIME_TYPES.has(file.mimetype)) throw new ConflictException('Only JSON files are supported in phase 1');
    try { JSON.parse(file.buffer.toString('utf8')); } catch { throw new ConflictException('The JSON file cannot be parsed'); }
    const robot = await this.prisma.robot.findUnique({ where: { id: input.robotId }, select: { id: true, externalId: true } });
    if (!robot) throw new NotFoundException('Robot not found');
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    if (await this.prisma.robotFile.findUnique({ where: { checksum }, select: { id: true } })) throw new ConflictException('A file with this checksum already exists');
    const capturedAt = new Date(input.capturedAt);
    if (Number.isNaN(capturedAt.valueOf())) throw new ConflictException('capturedAt must be a valid date');
    const robotCode = robot.externalId ?? robot.id;
    const uuid = randomUUID();
    const objectKey = `raw/${robotCode}/${capturedAt.getUTCFullYear()}/${String(capturedAt.getUTCMonth() + 1).padStart(2, '0')}/${String(capturedAt.getUTCDate()).padStart(2, '0')}/${uuid}${extension}`;
    await this.storage.putObject({ objectKey, content: file.buffer, contentType: file.mimetype });
    try {
      return this.serialize(await this.prisma.robotFile.create({ data: { robotId: robot.id, objectKey, originalName: file.originalname, fileType: 'json', mimeType: file.mimetype, fileSize: BigInt(file.size), checksum, recognitionType: input.recognitionType, schemaVersion: input.schemaVersion, capturedAt } }));
    } catch (error: unknown) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async list(query: ListFilesQueryDto) {
    const where = { robotId: query.robotId, fileType: query.fileType, recognitionType: query.recognitionType, capturedAt: { gte: query.startTime ? new Date(query.startTime) : undefined, lte: query.endTime ? new Date(query.endTime) : undefined } };
    const [items, total] = await this.prisma.$transaction([this.prisma.robotFile.findMany({ where, select: { id: true, robotId: true, objectKey: true, originalName: true, fileType: true, mimeType: true, fileSize: true, checksum: true, recognitionType: true, schemaVersion: true, capturedAt: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.robotFile.count({ where })]);
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string) { const item = await this.find(id); return this.serialize(item); }
  async getDownloadUrl(id: string) { const item = await this.find(id); if (!(await this.storage.exists(item.objectKey))) throw new NotFoundException('Stored object not found'); return { url: await this.storage.getPresignedDownloadUrl(item.objectKey) }; }
  async delete(id: string): Promise<void> { const item = await this.find(id); await this.storage.deleteObject(item.objectKey); await this.prisma.robotFile.delete({ where: { id } }); }

  private async find(id: string) { const item = await this.prisma.robotFile.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Robot file not found'); return item; }
  private serialize<T extends { fileSize: bigint }>(item: T): Omit<T, 'fileSize'> & { fileSize: string } { return { ...item, fileSize: item.fileSize.toString() }; }
}
