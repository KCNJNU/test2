import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoginRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : 'invalid-account';
    const ip = typeof request.ip === 'string' ? request.ip : 'unknown-ip';
    return `${ip}:${email}`;
  }
}
