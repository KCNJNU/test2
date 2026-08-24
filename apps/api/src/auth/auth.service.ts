import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const safeUser = (user: { id: string; email: string; displayName: string; role: UserRole; tenantId: string | null; mustChangePassword: boolean; isActive: boolean; projectAccess?: Array<{ projectId: string }> }) => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role === 'ADMIN' ? 'SUPER_ADMIN' as UserRole : user.role, tenantId: user.tenantId, projectIds: user.projectAccess?.map((access) => access.projectId) ?? [], mustChangePassword: user.mustChangePassword, isActive: user.isActive });

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: { projectAccess: { select: { projectId: true } } } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid email or password');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Account is temporarily locked');
    if (!await argon2.verify(user.passwordHash, password).catch(() => false)) {
      const failures = user.failedLoginCount + 1;
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: failures >= 5 ? 0 : failures, lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
      throw new UnauthorizedException('Invalid email or password');
    }
    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionHours() * 60 * 60_000);
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
      return tx.session.create({ data: { userId: user.id, tokenHash: hashToken(sessionToken), csrfTokenHash: hashToken(csrfToken), expiresAt } });
    });
    return { user: safeUser(user), sessionToken, csrfToken, sessionId: session.id, expiresAt };
  }

  async resolveSession(token: string) {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { projectAccess: { select: { projectId: true } } } } } });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { sessionId: session.id, csrfTokenHash: session.csrfTokenHash, user: safeUser(session.user) };
  }

  async rotateCsrf(sessionId: string) {
    const csrfToken = randomBytes(32).toString('base64url');
    await this.prisma.session.update({ where: { id: sessionId }, data: { csrfTokenHash: hashToken(csrfToken) } });
    return csrfToken;
  }

  verifyCsrf(value: string | undefined, expectedHash: string | undefined) { return Boolean(value && expectedHash && hashToken(value) === expectedHash); }
  async logout(sessionId: string) { await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined); }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 12) throw new BadRequestException('Password must contain at least 12 characters');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !await argon2.verify(user.passwordHash, currentPassword).catch(() => false)) throw new ForbiddenException('Current password is incorrect');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }), this.prisma.session.deleteMany({ where: { userId } })]);
  }

  cookieOptions() { return { httpOnly: true, sameSite: 'lax' as const, secure: this.config.get('NODE_ENV') === 'production' || this.config.get('AUTH_COOKIE_SECURE') === 'true', maxAge: this.sessionHours() * 60 * 60_000, path: '/' }; }
  private sessionHours() { const value = Number(this.config.get('AUTH_SESSION_HOURS') ?? 12); return Number.isFinite(value) && value > 0 && value <= 168 ? value : 12; }
}
