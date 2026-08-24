import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SavedViewResource, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED: Record<SavedViewResource, Set<string>> = {
  ROBOTS: new Set(['search', 'activity', 'sortBy', 'sortOrder', 'pageSize']),
  FILES: new Set(['search', 'robotId', 'fileType', 'recognitionType', 'schemaVersion', 'tagId', 'startTime', 'endTime', 'uploadedStartTime', 'uploadedEndTime', 'minSize', 'maxSize', 'sortBy', 'sortOrder', 'pageSize', 'view']),
  DATASETS: new Set(['search', 'status', 'tagId', 'sortBy', 'sortOrder', 'pageSize']),
  VERSIONS: new Set(['search', 'datasetId', 'status', 'sortBy', 'sortOrder', 'pageSize']),
  JOBS: new Set(['search', 'status', 'type', 'pageSize']),
  AUDIT: new Set(['search', 'actorUserId', 'action', 'startTime', 'endTime', 'pageSize']),
  STORAGE: new Set(['prefix', 'mapping', 'pageSize']),
};

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string, resource?: SavedViewResource) { return this.prisma.savedView.findMany({ where: { resource, OR: [{ ownerId: userId }, { isShared: true }] }, include: { owner: { select: { id: true, displayName: true } } }, orderBy: { updatedAt: 'desc' } }); }
  create(userId: string, role: UserRole, input: { resource: SavedViewResource; name: string; query: unknown; isShared?: boolean }) { this.assertShare(role, input.isShared); return this.prisma.savedView.create({ data: { ownerId: userId, resource: input.resource, name: input.name.trim(), query: this.validate(input.resource, input.query), isShared: input.isShared ?? false } }); }
  async update(id: string, userId: string, role: UserRole, input: { name?: string; query?: unknown; isShared?: boolean }) { const view = await this.getOwned(id, userId); this.assertShare(role, input.isShared); return this.prisma.savedView.update({ where: { id }, data: { name: input.name?.trim(), query: input.query === undefined ? undefined : this.validate(view.resource, input.query), isShared: input.isShared } }); }
  async remove(id: string, userId: string) { await this.getOwned(id, userId); await this.prisma.savedView.delete({ where: { id } }); }
  async copy(id: string, userId: string, name?: string) { const source = await this.prisma.savedView.findFirst({ where: { id, OR: [{ ownerId: userId }, { isShared: true }] } }); if (!source) throw new NotFoundException('Saved view not found'); return this.prisma.savedView.create({ data: { ownerId: userId, resource: source.resource, name: name?.trim() || `${source.name} copy`, query: source.query as Prisma.InputJsonValue } }); }
  private validate(resource: SavedViewResource, value: unknown): Prisma.InputJsonObject { if (!value || Array.isArray(value) || typeof value !== 'object') throw new BadRequestException('query must be an object'); const entries = Object.entries(value as Record<string, unknown>); const invalid = entries.find(([key]) => !ALLOWED[resource].has(key)); if (invalid) throw new BadRequestException(`Unsupported saved view field: ${invalid[0]}`); return Object.fromEntries(entries.filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item) || item === null)) as Prisma.InputJsonObject; }
  private assertShare(role: UserRole, shared?: boolean) { if (shared && role === UserRole.VIEWER) throw new ForbiddenException('Viewers cannot share saved views'); }
  private async getOwned(id: string, ownerId: string) { const view = await this.prisma.savedView.findFirst({ where: { id, ownerId } }); if (!view) throw new NotFoundException('Saved view not found'); return view; }
}
