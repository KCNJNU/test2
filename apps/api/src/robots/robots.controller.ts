import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateRobotDto } from './dto/create-robot.dto';
import { ListRobotsQueryDto } from './dto/list-robots-query.dto';
import { RobotsService } from './robots.service';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';

@ApiTags('robots')
@Controller('v1/robots')
export class RobotsController {
  constructor(private readonly robots: RobotsService) {}

  @Get()
  @ApiOkResponse()
  list(@CurrentUser() user: AuthUser) { return this.robots.list(user); }

  @Get('page')
  @ApiOkResponse()
  page(@Query() query: ListRobotsQueryDto, @CurrentUser() user: AuthUser) { return this.robots.page(query, user); }

  @Get(':id')
  @ApiOkResponse()
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.robots.get(id, user); }

  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  @ApiCreatedResponse()
  create(@Body() body: CreateRobotDto, @CurrentUser() user: AuthUser) { return this.robots.create(body, user); }
}
