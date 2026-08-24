import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(rawQuery: string, limit: number,scope?:AuthUser) {
    const q = rawQuery.trim();
    const contains = { contains: q, mode: 'insensitive' as const };
    const tenant= !scope||scope.role==='ADMIN'||scope.role==='SUPER_ADMIN'?{}:{tenantId:scope.tenantId??'__NO_TENANT__',...(scope.role==='TENANT_ADMIN'?{}:{projectId:{in:scope.projectIds}})};
    const scoped=Object.keys(tenant).length>0;
    const [robots, files, datasets, versions] = await Promise.all([
      this.prisma.robot.findMany({ where: { ...tenant,OR: [{ name: contains }, { externalId: contains }] }, select: { id: true, name: true, externalId: true }, take: limit, orderBy: { updatedAt: 'desc' } }),
      this.prisma.robotFile.findMany({ where: { ...(scoped&&{robot:tenant}),OR: [{ originalName: contains }, { objectKey: contains }, { checksum: contains }] }, select: { id: true, originalName: true, objectKey: true, checksum: true, robot: { select: { name: true, externalId: true } } }, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.dataset.findMany({ where: { ...tenant,OR: [{ name: contains }, { description: contains }] }, select: { id: true, name: true, description: true }, take: limit, orderBy: { updatedAt: 'desc' } }),
      this.prisma.datasetVersion.findMany({ where: { ...(scoped&&{dataset:tenant}),OR: [{ gitTag: contains }, { gitCommit: contains }, { dataset: { name: contains } }] }, select: { id: true, version: true, status: true, gitTag: true, dataset: { select: { id: true, name: true } } }, take: limit, orderBy: { updatedAt: 'desc' } }),
    ]);
    return {
      query: q,
      groups: {
        robots: robots.map((item) => ({ type: 'robot' as const, id: item.id, title: item.externalId ?? item.name, subtitle: item.name })),
        files: files.map((item) => ({ type: 'file' as const, id: item.id, title: item.originalName, subtitle: `${item.robot.externalId ?? item.robot.name} · ${item.objectKey}`, match: item.checksum })),
        datasets: datasets.map((item) => ({ type: 'dataset' as const, id: item.id, title: item.name, subtitle: item.description ?? 'Dataset' })),
        versions: versions.map((item) => ({ type: 'version' as const, id: item.id, title: `${item.dataset.name} v${item.version}`, subtitle: item.gitTag ?? item.status, datasetId: item.dataset.id })),
      },
    };
  }
}
