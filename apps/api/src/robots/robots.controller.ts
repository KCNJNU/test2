import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('robots')
@Controller('v1/robots')
export class RobotsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse()
  list() { return this.prisma.robot.findMany({ orderBy: { createdAt: 'desc' } }); }
}
