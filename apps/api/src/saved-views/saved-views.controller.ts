import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { SavedViewResource } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { SavedViewsService } from './saved-views.service';

class CreateViewDto { @IsEnum(SavedViewResource) resource!: SavedViewResource; @IsString() @IsNotEmpty() name!: string; @IsObject() query!: Record<string, unknown>; @IsOptional() @IsBoolean() isShared?: boolean; }
class UpdateViewDto { @IsOptional() @IsString() @IsNotEmpty() name?: string; @IsOptional() @IsObject() query?: Record<string, unknown>; @IsOptional() @IsBoolean() isShared?: boolean; }
class CopyViewDto { @IsOptional() @IsString() name?: string; }

@Controller('v1/saved-views')
export class SavedViewsController {
  constructor(private readonly views: SavedViewsService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query('resource') resource?: SavedViewResource) { return this.views.list(user.id, resource); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: CreateViewDto) { return this.views.create(user.id, user.role, body); }
  @Patch(':id') update(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: UpdateViewDto) { return this.views.update(id, user.id, user.role, body); }
  @Delete(':id') @HttpCode(204) remove(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.views.remove(id, user.id); }
  @Post(':id/copy') copy(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: CopyViewDto) { return this.views.copy(id, user.id, body.name); }
}
