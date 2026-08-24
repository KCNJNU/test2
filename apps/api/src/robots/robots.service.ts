import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type RobotFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRobotDto } from './dto/create-robot.dto';
import { ListRobotsQueryDto } from './dto/list-robots-query.dto';
import { AuthUser } from '../auth/auth.types';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class RobotsService {
  constructor(private readonly prisma: PrismaService) {}

  list(scope?: AuthUser) { return this.prisma.robot.findMany({ where: this.robotScope(scope), orderBy: { createdAt: 'desc' } }); }

  async page(query: ListRobotsQueryDto, scope?: AuthUser) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const search = query.search?.trim();
    const where: Prisma.RobotWhereInput = {
      ...this.robotScope(scope),
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { externalId: { contains: search, mode: 'insensitive' } }] }),
      ...(query.activity === 'ACTIVE' && { files: { some: { createdAt: { gte: since } } } }),
      ...(query.activity === 'IDLE' && { AND: [{ files: { some: {} } }, { files: { none: { createdAt: { gte: since } } } }] }),
      ...(query.activity === 'NO_DATA' && { files: { none: {} } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.robot.findMany({ where, orderBy: { [query.sortBy]: query.sortOrder }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.robot.count({ where }),
    ]);
    const ids = items.map((item) => item.id);
    const [aggregates, recentCounts, recognitionTypes] = ids.length ? await Promise.all([
      this.prisma.robotFile.groupBy({ by: ['robotId'], where: { robotId: { in: ids } }, _count: { _all: true }, _sum: { fileSize: true }, _max: { createdAt: true } }),
      this.prisma.robotFile.groupBy({ by: ['robotId'], where: { robotId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.robotFile.findMany({ where: { robotId: { in: ids } }, distinct: ['robotId', 'recognitionType'], select: { robotId: true, recognitionType: true } }),
    ]) : [[], [], []];
    const aggregateMap = new Map(aggregates.map((item) => [item.robotId, item]));
    const recentMap = new Map(recentCounts.map((item) => [item.robotId, item._count._all]));
    return {
      items: items.map((item) => {
        const aggregate = aggregateMap.get(item.id);
        const lastUpload = aggregate?._max.createdAt ?? null;
        return {
          ...item,
          stats: {
            lastUpload: lastUpload?.toISOString() ?? null,
            files24h: recentMap.get(item.id) ?? 0,
            totalFiles: aggregate?._count._all ?? 0,
            totalBytes: (aggregate?._sum.fileSize ?? 0n).toString(),
            recognitionTypes: recognitionTypes.filter((type) => type.robotId === item.id).map((type) => type.recognitionType),
            activityStatus: !lastUpload ? 'NO_DATA' : lastUpload >= since ? 'ACTIVE' : 'IDLE',
          },
        };
      }),
      total, page: query.page, pageSize: query.pageSize,
    };
  }

  async get(id: string, scope?: AuthUser) {
    const robot = await this.prisma.robot.findFirst({ where: { id, ...this.robotScope(scope) } });
    if (!robot) throw new NotFoundException('Robot not found');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [aggregate, recentCount, recognitionTypes, recentFiles, datasets] = await Promise.all([
      this.prisma.robotFile.aggregate({ where: { robotId: id }, _count: { _all: true }, _sum: { fileSize: true }, _max: { createdAt: true } }),
      this.prisma.robotFile.count({ where: { robotId: id, createdAt: { gte: since } } }),
      this.prisma.robotFile.findMany({ where: { robotId: id }, distinct: ['recognitionType'], select: { recognitionType: true } }),
      this.prisma.robotFile.findMany({ where: { robotId: id }, select: { id: true, originalName: true, fileType: true, fileSize: true, recognitionType: true, capturedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.dataset.findMany({ where: { versions: { some: { files: { some: { robotFile: { robotId: id } } } } } }, select: { id: true, name: true, versions: { where: { files: { some: { robotFile: { robotId: id } } } }, select: { id: true, version: true, status: true }, orderBy: { version: 'desc' } } }, take: 20 }),
    ]);
    const lastUpload = aggregate._max.createdAt;
    return {
      ...robot,
      stats: { lastUpload: lastUpload?.toISOString() ?? null, files24h: recentCount, totalFiles: aggregate._count._all, totalBytes: (aggregate._sum.fileSize ?? 0n).toString(), recognitionTypes: recognitionTypes.map((item) => item.recognitionType), activityStatus: !lastUpload ? 'NO_DATA' : lastUpload >= since ? 'ACTIVE' : 'IDLE' },
      recentFiles: recentFiles.map((file) => this.serializeFile(file)),
      datasets,
    };
  }

  async create(input: CreateRobotDto, scope?: AuthUser) {
    try {
      const assignment = this.assignment(scope);
      return await this.prisma.robot.create({ data: { name: input.name.trim(), externalId: input.externalId?.trim() || null, metadata: input.metadata as Prisma.InputJsonValue | undefined, ...assignment } });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A robot with this external ID already exists');
      throw error;
    }
  }

  private robotScope(scope?: AuthUser): Prisma.RobotWhereInput { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; return { tenantId: scope.tenantId ?? '__NO_TENANT__', ...(scope.role === 'TENANT_ADMIN' ? {} : { projectId: { in: scope.projectIds } }) }; }
  private assignment(scope?: AuthUser) { if (!scope || scope.role === 'ADMIN' || scope.role === 'SUPER_ADMIN') return {}; if (!scope.tenantId) throw new BadRequestException('Authenticated user has no tenant'); if (scope.projectIds.length !== 1) throw new BadRequestException('Exactly one project assignment is required to create a robot'); return { tenantId: scope.tenantId, projectId: scope.projectIds[0] }; }

  private serializeFile<T extends Pick<RobotFile, 'fileSize'>>(file: T): Omit<T, 'fileSize'> & { fileSize: string } { return { ...file, fileSize: file.fileSize.toString() }; }
}
