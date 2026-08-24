import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>(); const response = context.switchToHttp().getResponse<{ statusCode: number }>(); const started = Date.now();
    const shouldAudit = !['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.path.endsWith('/download');
    const rawResourceId = request.params?.id;
    const resourceId = Array.isArray(rawResourceId) ? rawResourceId[0] : rawResourceId;
    return next.handle().pipe(tap({ finalize: () => { if (shouldAudit) void this.audit.record({ actorUserId: request.user?.id, action: `${request.method} ${request.route?.path ?? request.path}`, method: request.method, route: request.path, resourceType: resourceId ? request.path.split('/').filter(Boolean).slice(-2, -1)[0] : undefined, resourceId, statusCode: response.statusCode, requestId: request.requestId, ipAddress: request.ip, userAgent: request.header('user-agent'), durationMs: Date.now() - started }).catch(() => undefined); } }));
  }
}
