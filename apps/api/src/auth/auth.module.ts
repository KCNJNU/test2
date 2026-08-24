import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { ProductionSecurityValidator } from './production-security.validator';

@Global()
@Module({ imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])], controllers: [AuthController], providers: [AuthService, LoginRateLimitGuard, ProductionSecurityValidator, { provide: ThrottlerStorage, useClass: RedisThrottlerStorage }, { provide: APP_GUARD, useClass: AuthGuard }], exports: [AuthService] })
export class AuthModule {}
