import { Controller, Get, Patch, Post, Query, Param } from '@nestjs/common';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/auth.decorators'; import { AuthUser } from '../auth/auth.types'; import { PrismaService } from '../prisma/prisma.service';
class NotificationQuery { @Type(() => Number) @IsInt() @Min(1) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() unreadOnly?: boolean; }
@Controller('v1/notifications') export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async list(@Query() query: NotificationQuery, @CurrentUser() user: AuthUser) { const where = { userId: user.id, ...(query.unreadOnly && { readAt: null }) }; const [items, total, unread] = await this.prisma.$transaction([this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.notification.count({ where }), this.prisma.notification.count({ where: { userId: user.id, readAt: null } })]); return { items, total, unread, page: query.page, pageSize: query.pageSize }; }
  @Patch(':id/read') async read(@Param('id') id: string, @CurrentUser() user: AuthUser) { await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } }); return { success: true }; }
  @Post('read-all') async readAll(@CurrentUser() user: AuthUser) { await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }); return { success: true }; }
}
