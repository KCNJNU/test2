import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobStatus, JobType, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { JobsService } from './jobs.service';

class JobPageQuery { @Type(() => Number) @IsInt() @Min(1) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsOptional() @IsEnum(JobStatus) status?: JobStatus; @IsOptional() @IsEnum(JobType) type?: JobType; @IsOptional() @IsString() search?: string; }
@Controller('v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Get('page') page(@Query() query: JobPageQuery, @CurrentUser() user: AuthUser) { return this.jobs.page({ ...query, requestedById: user.id }, user); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.jobs.getScoped(id, user); }
  @Roles(UserRole.ADMIN, UserRole.OPERATOR) @Post(':id/retry') retry(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.jobs.retry(id, user); }
  @Roles(UserRole.ADMIN, UserRole.OPERATOR) @Post(':id/cancel') cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.jobs.cancel(id, user); }
}
