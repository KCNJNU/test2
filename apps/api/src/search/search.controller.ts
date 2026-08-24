import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SearchService } from './search.service';
import { CurrentUser } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

class SearchQueryDto {
  @IsString() @MinLength(1) @MaxLength(100) q!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) limit = 5;
}

@ApiTags('search')
@Controller('v1/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}
  @Get() @ApiOkResponse() get(@Query() query: SearchQueryDto,@CurrentUser() user:AuthUser) { return this.search.search(query.q, query.limit,user); }
}
