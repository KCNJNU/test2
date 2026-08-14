import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDatasetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
