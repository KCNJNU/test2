import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from './auth.guard';
import { PUBLIC_ROUTE, ROLES } from './auth.decorators';

describe('AuthGuard role compatibility', () => {
  const request = {
    cookies: { cr_session: 'session-token' },
    method: 'GET',
    path: '/v1/uploads',
    header: jest.fn(),
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === PUBLIC_ROUTE) return false;
      if (key === ROLES) return [UserRole.ADMIN];
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('treats SUPER_ADMIN as the compatibility successor of legacy ADMIN', async () => {
    const auth = {
      resolveSession: jest.fn().mockResolvedValue({
        sessionId: 'session-id', csrfTokenHash: 'csrf-hash',
        user: { id: 'user-id', email: 'admin@example.com', role: UserRole.SUPER_ADMIN, mustChangePassword: false },
      }),
      verifyCsrf: jest.fn(),
    };
    await expect(new AuthGuard(reflector as never, auth as never).canActivate(context)).resolves.toBe(true);
  });

  it('does not grant legacy ADMIN routes to unrelated roles', async () => {
    const auth = {
      resolveSession: jest.fn().mockResolvedValue({
        sessionId: 'session-id', csrfTokenHash: 'csrf-hash',
        user: { id: 'user-id', email: 'viewer@example.com', role: UserRole.VIEWER, mustChangePassword: false },
      }),
      verifyCsrf: jest.fn(),
    };
    await expect(new AuthGuard(reflector as never, auth as never).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
