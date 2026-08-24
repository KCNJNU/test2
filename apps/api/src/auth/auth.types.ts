import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type AuthUser = { id: string; email: string; displayName: string; role: UserRole; tenantId: string | null; projectIds: string[]; mustChangePassword: boolean };
export type AuthenticatedRequest = Request & { user?: AuthUser; sessionId?: string; csrfTokenHash?: string; requestId?: string; traceId?: string };
