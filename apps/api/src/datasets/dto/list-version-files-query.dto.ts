import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListVersionFilesQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() robotId?: string;
  @IsOptional() @IsString() recognitionType?: string;
  @IsOptional() @IsString() schemaVersion?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsIn(['createdAt', 'capturedAt', 'fileSize', 'originalName']) sortBy: 'createdAt' | 'capturedAt' | 'fileSize' | 'originalName' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
