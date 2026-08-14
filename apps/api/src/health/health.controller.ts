import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Return API liveness status' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  getHealth() { return { status: 'ok' }; }
}
