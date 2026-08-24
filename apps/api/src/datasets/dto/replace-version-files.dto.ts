import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceVersionFilesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  fileIds!: string[];
}
