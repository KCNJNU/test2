import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';
import { StructuredLoggerService } from './structured-logger.service';
import { TraceContextService } from './trace-context.service';
import { TraceMiddleware } from './trace.middleware';

@Global()
@Module({
  controllers: [MetricsController, ObservabilityController],
  providers: [TraceContextService, TraceMiddleware, StructuredLoggerService, MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
  exports: [TraceContextService, StructuredLoggerService, MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(TraceMiddleware).forRoutes('{*path}'); }
}
