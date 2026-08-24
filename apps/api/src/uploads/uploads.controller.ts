import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsDateString, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { UploadsService } from './uploads.service';

class CreateUploadDto {
  @IsUUID() robotId!: string; @IsString() @IsNotEmpty() originalName!: string; @IsString() @IsNotEmpty() mimeType!: string;
  @IsInt() @Min(1) @Max(2 * 1024 * 1024 * 1024) fileSize!: number; @Matches(/^[a-f0-9]{64}$/i) checksum!: string;
  @IsString() @IsNotEmpty() recognitionType!: string; @IsString() @IsNotEmpty() schemaVersion!: string; @IsDateString() capturedAt!: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>; @IsOptional() @IsInt() lastModified?: number;
}

@Controller('v1/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}
  @Post() @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROJECT_ADMIN, UserRole.OPERATOR) create(@CurrentUser() user: AuthUser, @Body() body: CreateUploadDto) { return this.uploads.create(user, body); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.uploads.get(id, user.id, user.role); }
  @Put(':id/parts/:partNumber') @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROJECT_ADMIN, UserRole.OPERATOR) putPart(@Param('id') id: string, @Param('partNumber', ParseIntPipe) part: number, @Headers('content-range') range: string | undefined, @Headers('x-part-sha256') checksum: string | undefined, @Body() content: Buffer, @CurrentUser() user: AuthUser) { if (!Buffer.isBuffer(content)) throw new Error('Part body must use application/octet-stream'); return this.uploads.putPart(id, part, range, checksum, content, user.id, user.role); }
  @Post(':id/complete') @HttpCode(202) @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROJECT_ADMIN, UserRole.OPERATOR) complete(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.uploads.complete(id, user.id, user.role); }
  @Delete(':id') @HttpCode(204) @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROJECT_ADMIN, UserRole.OPERATOR) abort(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.uploads.abort(id, user.id, user.role); }
}
