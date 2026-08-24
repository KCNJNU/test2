import { Injectable } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type IngestionRow = { day: Date; fileCount: bigint; bytes: bigint };
type RobotActivityRow = {
  id: string;
  name: string;
  externalId: string | null;
  lastUpload: Date | null;
  files24h: bigint;
  totalFiles: bigint;
  totalBytes: bigint;
  recognitionTypes: string[] | null;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const day24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [robots, files, fileSize, datasets, publishedVersions, ingestion, robotActivity, pipeline, recentFiles, recentDatasets, recentVersions, jobCounts, runningJobs, recentJobs] = await Promise.all([
      this.prisma.robot.count(),
      this.prisma.robotFile.count(),
      this.prisma.robotFile.aggregate({ _sum: { fileSize: true } }),
      this.prisma.dataset.count(),
      this.prisma.datasetVersion.count({ where: { status: DatasetVersionStatus.PUBLISHED } }),
      this.prisma.$queryRaw<IngestionRow[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               count(*)::bigint AS "fileCount",
               coalesce(sum("fileSize"), 0)::bigint AS bytes
        FROM "RobotFile"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1 ASC`,
      this.prisma.$queryRaw<RobotActivityRow[]>`
        SELECT r.id, r.name, r."externalId",
               max(f."createdAt") AS "lastUpload",
               count(f.id) FILTER (WHERE f."createdAt" >= ${day24})::bigint AS "files24h",
               count(f.id)::bigint AS "totalFiles",
               coalesce(sum(f."fileSize"), 0)::bigint AS "totalBytes",
               array_remove(array_agg(DISTINCT f."recognitionType"), NULL) AS "recognitionTypes"
        FROM "Robot" r
        LEFT JOIN "RobotFile" f ON f."robotId" = r.id
        GROUP BY r.id
        ORDER BY max(f."createdAt") DESC NULLS LAST, r."createdAt" DESC
        LIMIT 20`,
      this.prisma.datasetVersion.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.robotFile.findMany({ select: { id: true, originalName: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.dataset.findMany({ select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.datasetVersion.findMany({ select: { id: true, version: true, status: true, createdAt: true, frozenAt: true, dataset: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 6 }),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.job.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
      this.prisma.job.findMany({ select: { id: true, type: true, status: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 6 }),
    ]);

    const statuses: Record<DatasetVersionStatus, number> = { DRAFT: 0, FROZEN: 0, PUBLISHED: 0, ARCHIVED: 0 };
    for (const item of pipeline) statuses[item.status] = item._count._all;
    const recent = [
      ...recentFiles.map((item) => ({ type: 'file' as const, id: item.id, label: item.originalName, action: 'File uploaded', timestamp: item.createdAt.toISOString() })),
      ...recentDatasets.map((item) => ({ type: 'dataset' as const, id: item.id, label: item.name, action: 'Dataset created', timestamp: item.createdAt.toISOString() })),
      ...recentVersions.flatMap((item) => {
        const events = [{ type: 'version' as const, id: item.id, label: `${item.dataset.name} v${item.version}`, action: 'Version created', timestamp: item.createdAt.toISOString() }];
        if (item.frozenAt) events.push({ type: 'version', id: item.id, label: `${item.dataset.name} v${item.version}`, action: 'Version frozen', timestamp: item.frozenAt.toISOString() });
        return events;
      }),
      ...recentJobs.map((item) => ({ type: 'job' as const, id: item.id, label: item.type.replaceAll('_', ' '), action: `Job ${item.status.toLowerCase()}`, timestamp: item.updatedAt.toISOString() })),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10);

    return {
      rangeDays: days,
      summary: { robots, files, managedBytes: (fileSize._sum.fileSize ?? 0n).toString(), datasets, publishedVersions, jobs: { status: 'enabled' as const, active: runningJobs, total: jobCounts.reduce((sum, item) => sum + item._count._all, 0), byStatus: Object.fromEntries(jobCounts.map((item) => [item.status, item._count._all])) } },
      ingestion: ingestion.map((item) => ({ date: item.day.toISOString().slice(0, 10), fileCount: Number(item.fileCount), bytes: item.bytes.toString() })),
      robotActivity: robotActivity.map((item) => ({
        id: item.id, name: item.name, externalId: item.externalId,
        lastUpload: item.lastUpload?.toISOString() ?? null,
        files24h: Number(item.files24h), totalFiles: Number(item.totalFiles), totalBytes: item.totalBytes.toString(),
        recognitionTypes: item.recognitionTypes ?? [],
        activityStatus: !item.lastUpload ? 'NO_DATA' : item.lastUpload >= day24 ? 'ACTIVE' : 'IDLE',
      })),
      pipeline: statuses,
      recent,
    };
  }
}
