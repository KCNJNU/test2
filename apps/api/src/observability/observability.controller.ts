import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.types';
import { MetricsService } from './metrics.service';

@Controller('v1/observability')
export class ObservabilityController {
  constructor(private readonly metrics: MetricsService) {}
  @Get('summary') summary(@CurrentUser() user?: AuthUser) {
    if (!user) throw new UnauthorizedException();
    return this.metrics.summary(user);
  }
}
