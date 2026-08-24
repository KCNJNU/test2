import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListFilesQueryDto {
  @IsOptional() @IsUUID() robotId?: string;
  @IsOptional() @IsString() fileType?: string;
  @IsOptional() @IsString() recognitionType?: string;
  @IsOptional() @IsString() schemaVersion?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() checksum?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsDateString() uploadedStartTime?: string;
  @IsOptional() @IsDateString() uploadedEndTime?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minSize?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxSize?: number;
  @IsOptional() @IsIn(['createdAt', 'capturedAt', 'fileSize', 'originalName']) sortBy: 'createdAt' | 'capturedAt' | 'fileSize' | 'originalName' = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
