import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRobotDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) externalId?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
