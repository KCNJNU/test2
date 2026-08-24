import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { TraceContextService } from './trace-context.service';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly context: TraceContextService) {}
  use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const requestId = header(request.header('x-request-id')) ?? randomUUID();
    const traceId = traceFromParent(request.header('traceparent')) ?? traceHeader(request.header('x-trace-id')) ?? randomBytes(16).toString('hex');
    request.requestId = requestId;
    request.traceId = traceId;
    request.headers['x-request-id'] = requestId;
    request.headers['x-trace-id'] = traceId;
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-trace-id', traceId);
    this.context.run({ requestId, traceId }, next);
  }
}

function header(value: string | undefined) { return value && value.length <= 128 ? value : undefined; }
function traceHeader(value: string | undefined) { return value && /^[0-9a-f]{32}$/i.test(value) ? value.toLowerCase() : undefined; }
function traceFromParent(value: string | undefined) { const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(value ?? ''); return match?.[1].toLowerCase(); }
