import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PUBLIC_ROUTE, ROLES } from './auth.decorators';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.cr_session as string | undefined;
    if (!token) throw new UnauthorizedException('Authentication required');
    const resolved = await this.auth.resolveSession(token);
    if (!resolved) throw new UnauthorizedException('Session is invalid or expired');
    request.user = resolved.user; request.sessionId = resolved.sessionId; request.csrfTokenHash = resolved.csrfTokenHash;
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !this.auth.verifyCsrf(request.header('x-csrf-token'), resolved.csrfTokenHash)) throw new ForbiddenException('Invalid CSRF token');
    if (resolved.user.mustChangePassword && !request.path.endsWith('/auth/change-password') && !request.path.endsWith('/auth/logout') && !request.path.endsWith('/auth/session')) throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES, [context.getHandler(), context.getClass()]);
    const hasRequiredRole = !roles?.length
      || roles.includes(resolved.user.role)
      || (resolved.user.role === UserRole.SUPER_ADMIN && roles.includes(UserRole.ADMIN));
    if (!hasRequiredRole) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
