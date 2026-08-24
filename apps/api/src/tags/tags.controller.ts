import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Roles } from '../auth/auth.decorators';
import { TagsService } from './tags.service';

class CreateTagDto { @IsString() @IsNotEmpty() name!: string; @Matches(/^#[0-9a-f]{6}$/i) color!: string; }
class UpdateTagDto { @IsOptional() @IsString() @IsNotEmpty() name?: string; @IsOptional() @Matches(/^#[0-9a-f]{6}$/i) color?: string; }
class BulkTagDto { @IsArray() @IsUUID('4', { each: true }) fileIds!: string[]; @IsArray() @IsUUID('4', { each: true }) tagIds!: string[]; }

@Controller('v1/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}
  @Get() list() { return this.tags.list(); }
  @Post() @Roles(UserRole.ADMIN, UserRole.OPERATOR) create(@Body() body: CreateTagDto) { return this.tags.create(body.name, body.color); }
  @Patch(':id') @Roles(UserRole.ADMIN, UserRole.OPERATOR) update(@Param('id') id: string, @Body() body: UpdateTagDto) { return this.tags.update(id, body); }
  @Delete(':id') @HttpCode(204) @Roles(UserRole.ADMIN, UserRole.OPERATOR) remove(@Param('id') id: string) { return this.tags.remove(id); }
  @Post('files/bulk') @Roles(UserRole.ADMIN, UserRole.OPERATOR) bulk(@Body() body: BulkTagDto) { return this.tags.bulkAttachFiles(body.fileIds, body.tagIds); }
  @Post('files/:fileId/:tagId') @Roles(UserRole.ADMIN, UserRole.OPERATOR) attachFile(@Param('fileId') fileId: string, @Param('tagId') tagId: string) { return this.tags.attachFile(fileId, tagId); }
  @Delete('files/:fileId/:tagId') @HttpCode(204) @Roles(UserRole.ADMIN, UserRole.OPERATOR) detachFile(@Param('fileId') fileId: string, @Param('tagId') tagId: string) { return this.tags.detachFile(fileId, tagId); }
  @Post('datasets/:datasetId/:tagId') @Roles(UserRole.ADMIN, UserRole.OPERATOR) attachDataset(@Param('datasetId') datasetId: string, @Param('tagId') tagId: string) { return this.tags.attachDataset(datasetId, tagId); }
  @Delete('datasets/:datasetId/:tagId') @HttpCode(204) @Roles(UserRole.ADMIN, UserRole.OPERATOR) detachDataset(@Param('datasetId') datasetId: string, @Param('tagId') tagId: string) { return this.tags.detachDataset(datasetId, tagId); }
}
