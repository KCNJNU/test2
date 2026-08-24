import { IsUUID } from 'class-validator';

export class CompareVersionsQueryDto {
  @IsUUID('4') baseVersionId!: string;
  @IsUUID('4') targetVersionId!: string;
}
