import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, finalize } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { MetricsService } from './metrics.service';
import { StructuredLoggerService } from './structured-logger.service';
import { TraceContextService } from './trace-context.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService, private readonly trace: TraceContextService, private readonly logger: StructuredLoggerService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const started = process.hrtime.bigint();
    if (request.user) this.trace.update({ userId: request.user.id });
    return next.handle().pipe(finalize(() => {
      const seconds = Number(process.hrtime.bigint() - started) / 1_000_000_000;
      const route = routeName(request);
      this.metrics.observeHttp(request.method, route, response.statusCode, seconds);
      this.logger.event(response.statusCode >= 500 ? 'error' : 'log', 'http_request_completed', { method: request.method, route, statusCode: response.statusCode, durationMs: Math.round(seconds * 1000) });
    }));
  }
}

function routeName(request: AuthenticatedRequest) {
  const route = request.route?.path as string | undefined;
  return route ? `${request.baseUrl ?? ''}${route}` : 'unmatched';
}
