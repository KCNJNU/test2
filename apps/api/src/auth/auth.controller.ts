import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import { AuthenticatedRequest, AuthUser } from './auth.types';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
class ChangePasswordDto { @IsString() currentPassword!: string; @IsString() @MinLength(12) newPassword!: string; }

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') @UseGuards(LoginRateLimitGuard) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body.email, body.password);
    response.cookie('cr_session', result.sessionToken, this.auth.cookieOptions());
    return { user: result.user, csrfToken: result.csrfToken, expiresAt: result.expiresAt };
  }
  @Get('session') async session(@CurrentUser() user: AuthUser, @Req() request: AuthenticatedRequest) { return { user, csrfToken: await this.auth.rotateCsrf(request.sessionId!) }; }
  @Post('logout') async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { await this.auth.logout(request.sessionId!); response.clearCookie('cr_session', { path: '/' }); return { success: true }; }
  @Post('change-password') async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto, @Res({ passthrough: true }) response: Response) { await this.auth.changePassword(user.id, body.currentPassword, body.newPassword); response.clearCookie('cr_session', { path: '/' }); return { success: true, reauthenticate: true }; }
}
