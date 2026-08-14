import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateDatasetVersionDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  fileIds?: string[];
}
