import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import { FilesService } from './files.service';
import { UploadedFile as UploadedFilePayload } from './uploaded-file';

class CreateFileDto { @IsUUID() robotId!: string; @IsString() @IsNotEmpty() recognitionType!: string; @IsDateString() capturedAt!: string; @IsString() @IsNotEmpty() schemaVersion!: string; @IsOptional() @IsString() metadata?: string; }

@ApiTags('files') @Controller('v1/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}
  @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.TENANT_ADMIN,UserRole.PROJECT_ADMIN,UserRole.OPERATOR)
  @Post() @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10*1024*1024}})) @ApiOperation({summary:'Upload a JSON robot recognition file'}) @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object'}}) @ApiCreatedResponse()
  create(@Body() body:CreateFileDto,@UploadedFile() file:UploadedFilePayload,@CurrentUser() user:AuthUser){return this.files.create({...body,file},user);}
  @Get() @ApiOkResponse() list(@Query() query:ListFilesQueryDto,@CurrentUser() user:AuthUser){return this.files.list(query,user);}
  @Get(':id') @ApiOkResponse() get(@Param('id') id:string,@CurrentUser() user:AuthUser){return this.files.get(id,user);}
  @Get(':id/download') @ApiOkResponse() download(@Param('id') id:string,@CurrentUser() user:AuthUser){return this.files.getDownloadUrl(id,user);}
  @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN,UserRole.TENANT_ADMIN,UserRole.PROJECT_ADMIN,UserRole.OPERATOR)
  @Delete(':id') @HttpCode(204) remove(@Param('id') id:string,@CurrentUser() user:AuthUser){return this.files.delete(id,user);}
}
