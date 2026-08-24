import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { StorageOperationsService } from './storage-operations.service';

class ObjectsQuery { @IsOptional() @IsString() prefix?: string; @IsOptional() @IsString() cursor?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50; }
class PageQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; }
class IgnoreIssueDto { @IsOptional() @IsString() note?: string; }
class DeleteOrphansDto { @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) issueIds!: string[]; @IsString() confirmation!: string; }

@Controller('v1/storage')
export class StorageController {
  constructor(private readonly operations: StorageOperationsService) {}
  @Get('objects') objects(@Query() query: ObjectsQuery) { return this.operations.pageObjects(query.prefix, query.cursor, query.limit); }
  @Post('reconciliation-runs') @HttpCode(202) @Roles(UserRole.ADMIN, UserRole.OPERATOR) scan(@CurrentUser() user: AuthUser) { return this.operations.enqueueScan(user.id); }
  @Get('reconciliation-runs/page') runs(@Query() query: PageQuery) { return this.operations.pageRuns(query.page, query.pageSize); }
  @Get('reconciliation-runs/:id') run(@Param('id') id: string) { return this.operations.getRun(id); }
  @Patch('reconciliation-issues/:id/ignore') @Roles(UserRole.ADMIN, UserRole.OPERATOR) ignore(@Param('id') id: string, @Body() body: IgnoreIssueDto) { return this.operations.ignoreIssue(id, body.note); }
  @Post('orphan-deletion-jobs') @HttpCode(202) @Roles(UserRole.ADMIN) deleteOrphans(@CurrentUser() user: AuthUser, @Body() body: DeleteOrphansDto) { return this.operations.enqueueOrphanDelete(user.id, user.role, body.issueIds, body.confirmation); }
}
