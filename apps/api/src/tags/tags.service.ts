import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tag.findMany({
      include: { _count: { select: { robotFiles: true, datasets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(name: string, color: string) {
    this.assertColor(color);
    try { return await this.prisma.tag.create({ data: { name: name.trim(), color } }); }
    catch (error) { this.throwConflict(error); }
  }

  async update(id: string, input: { name?: string; color?: string }) {
    if (input.color) this.assertColor(input.color);
    try { return await this.prisma.tag.update({ where: { id }, data: { name: input.name?.trim(), color: input.color } }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Tag not found');
      this.throwConflict(error);
    }
  }

  async remove(id: string) {
    try { await this.prisma.tag.delete({ where: { id } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Tag not found'); throw error; }
  }

  attachFile(fileId: string, tagId: string) { return this.prisma.robotFileTag.upsert({ where: { robotFileId_tagId: { robotFileId: fileId, tagId } }, update: {}, create: { robotFileId: fileId, tagId } }); }
  detachFile(fileId: string, tagId: string) { return this.prisma.robotFileTag.deleteMany({ where: { robotFileId: fileId, tagId } }); }
  attachDataset(datasetId: string, tagId: string) { return this.prisma.datasetTag.upsert({ where: { datasetId_tagId: { datasetId, tagId } }, update: {}, create: { datasetId, tagId } }); }
  detachDataset(datasetId: string, tagId: string) { return this.prisma.datasetTag.deleteMany({ where: { datasetId, tagId } }); }
  async bulkAttachFiles(fileIds: string[], tagIds: string[]) {
    if (!fileIds.length || !tagIds.length) throw new BadRequestException('fileIds and tagIds are required');
    const [files, tags] = await Promise.all([this.prisma.robotFile.count({ where: { id: { in: fileIds } } }), this.prisma.tag.count({ where: { id: { in: tagIds } } })]);
    if (files !== new Set(fileIds).size || tags !== new Set(tagIds).size) throw new NotFoundException('One or more files or tags were not found');
    const pairs = fileIds.flatMap((robotFileId) => tagIds.map((tagId) => ({ robotFileId, tagId })));
    await this.prisma.robotFileTag.createMany({ data: pairs, skipDuplicates: true });
    return { attached: pairs.length };
  }

  private assertColor(color: string) { if (!/^#[0-9a-f]{6}$/i.test(color)) throw new BadRequestException('color must be a six-digit hex value'); }
  private throwConflict(error: unknown): never { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Tag name already exists'); throw error; }
}
