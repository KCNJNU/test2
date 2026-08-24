import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class ActivityQuery { @Type(() => Number) @IsInt() @Min(1) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30; @IsOptional() @IsString() search?: string; }

@Controller('v1/activity')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('page') async page(@Query() query: ActivityQuery) {
    const take = Math.min(100, query.page * query.pageSize);
    const [audits, jobs] = await Promise.all([
      this.prisma.auditLog.findMany({ where: query.search ? { OR: [{ action: { contains: query.search, mode: 'insensitive' } }, { resourceType: { contains: query.search, mode: 'insensitive' } }] } : undefined, include: { actor: { select: { id: true, displayName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take }),
      this.prisma.job.findMany({ where: query.search ? { OR: [{ resourceType: { contains: query.search, mode: 'insensitive' } }, { resourceId: { contains: query.search, mode: 'insensitive' } }] } : undefined, include: { requestedBy: { select: { id: true, displayName: true, email: true } } }, orderBy: { updatedAt: 'desc' }, take }),
    ]);
    const merged = [
      ...audits.map((item) => ({ id: `audit:${item.id}`, source: 'audit', type: item.action, status: item.statusCode && item.statusCode >= 400 ? 'failed' : 'completed', actor: item.actor, resourceType: item.resourceType, resourceId: item.resourceId, timestamp: item.createdAt })),
      ...jobs.map((item) => ({ id: `job:${item.id}`, source: 'job', type: item.type, status: item.status.toLowerCase(), actor: item.requestedBy, resourceType: item.resourceType, resourceId: item.resourceId, jobId: item.id, timestamp: item.updatedAt })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const start = (query.page - 1) * query.pageSize;
    return { items: merged.slice(start, start + query.pageSize), total: merged.length < take * 2 ? start + merged.length : start + merged.length + 1, page: query.page, pageSize: query.pageSize };
  }
}
