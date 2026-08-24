import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { DashboardService } from './dashboard.service';

class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 7, 30])
  days = 7;
}

@ApiTags('dashboard')
@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOkResponse()
  get(@Query() query: DashboardQueryDto) { return this.dashboard.get(query.days); }
}
