import { Controller, Get, Header, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { AuditService } from './audit.service';

class AuditQuery { @Type(() => Number) @IsInt() @Min(1) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsOptional() @IsString() search?: string; @IsOptional() @IsString() action?: string; @IsOptional() @IsUUID() actorUserId?: string; }

@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
@Controller('v1/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get('page') page(@Query() query: AuditQuery, @CurrentUser() user: AuthUser) { return this.audit.page(query, user); }
  @Get('export') @Header('Content-Type', 'text/csv; charset=utf-8') async export(@Query() query: AuditQuery, @CurrentUser() user: AuthUser) { const page = await this.audit.page({ ...query, page: 1, pageSize: 100 }, user); return ['createdAt,actor,action,resourceType,resourceId,statusCode', ...page.items.map((item) => [item.createdAt.toISOString(), item.actor?.email ?? 'system', item.action, item.resourceType ?? '', item.resourceId ?? '', item.statusCode ?? ''].map(csv).join(','))].join('\n'); }
}
const csv = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
