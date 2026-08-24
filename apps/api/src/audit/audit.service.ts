import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  record(input: { actorUserId?: string; action: string; method?: string; route?: string; resourceType?: string; resourceId?: string; statusCode?: number; requestId?: string; ipAddress?: string; userAgent?: string; durationMs?: number; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.auditLog.create({ data: input });
  }
  async page(query: { page: number; pageSize: number; search?: string; action?: string; actorUserId?: string }, scope?: AuthUser) {
    const where: Prisma.AuditLogWhereInput = { action: query.action, actorUserId: query.actorUserId, ...(!scope||scope.role==='ADMIN'||scope.role==='SUPER_ADMIN'?{}:{tenantId:scope.tenantId??'__NO_TENANT__',...(scope.role==='TENANT_ADMIN'?{}:{projectId:{in:scope.projectIds}})}), ...(query.search && { OR: [{ action: { contains: query.search, mode: 'insensitive' } }, { resourceType: { contains: query.search, mode: 'insensitive' } }, { resourceId: { contains: query.search, mode: 'insensitive' } }] }) };
    const [items, total] = await this.prisma.$transaction([this.prisma.auditLog.findMany({ where, include: { actor: { select: { id: true, email: true, displayName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.auditLog.count({ where })]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
