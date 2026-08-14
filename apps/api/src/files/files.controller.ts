import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FilesService } from './files.service';
import { UploadedFile as UploadedFilePayload } from './uploaded-file';

class CreateFileDto { @IsUUID() robotId!: string; @IsString() @IsNotEmpty() recognitionType!: string; @IsDateString() capturedAt!: string; @IsString() @IsNotEmpty() schemaVersion!: string; }

@ApiTags('files')
@Controller('v1/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}
  @Post() @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) @ApiOperation({ summary: 'Upload a JSON robot recognition file' }) @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', required: ['robotId', 'recognitionType', 'capturedAt', 'schemaVersion', 'file'], properties: { robotId: { type: 'string', format: 'uuid' }, recognitionType: { type: 'string' }, capturedAt: { type: 'string', format: 'date-time' }, schemaVersion: { type: 'string' }, file: { type: 'string', format: 'binary' } } } }) @ApiCreatedResponse() create(@Body() body: CreateFileDto, @UploadedFile() file: UploadedFilePayload) { return this.files.create({ ...body, file }); }
  @Get() @ApiOkResponse() list(@Query() query: ListFilesQueryDto) { return this.files.list(query); }
  @Get(':id') @ApiOkResponse() get(@Param('id') id: string) { return this.files.get(id); }
  @Get(':id/download') @ApiOkResponse() download(@Param('id') id: string) { return this.files.getDownloadUrl(id); }
  @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Delete a robot file and its stored object' }) remove(@Param('id') id: string) { return this.files.delete(id); }
}
