import { Type } from 'class-transformer';
import { DatasetVersionStatus } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListVersionsQueryDto {
  @IsOptional() @IsUUID() datasetId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(DatasetVersionStatus) status?: DatasetVersionStatus;
  @IsOptional() @IsIn(['createdAt', 'updatedAt', 'version', 'status']) sortBy: 'createdAt' | 'updatedAt' | 'version' | 'status' = 'updatedAt';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
