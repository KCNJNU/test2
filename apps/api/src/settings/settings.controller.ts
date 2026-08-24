import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { IsObject } from 'class-validator';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

class UpdateSettingsDto { @IsObject() values!: Record<string, unknown>; }
@Controller('v1/system')
export class SettingsController {
  constructor(private readonly settings: SettingsService, private readonly config: ConfigService, private readonly prisma: PrismaService) {}
  @Get('configuration') async configuration() { const heartbeat = await this.prisma.workerHeartbeat.findFirst({ orderBy: { heartbeatAt: 'desc' } }); return { settings: await this.settings.all(), infrastructure: { postgresql: { configured: Boolean(this.config.get('DATABASE_URL')) }, objectStorage: { configured: Boolean(this.config.get('OBJECT_STORAGE_ENDPOINT')), provider: 'minio', bucket: this.config.get('OBJECT_STORAGE_BUCKET') ?? null }, dvcRemote: { configured: Boolean(this.config.get('DVC_REMOTE_NAME')), provider: 's3-compatible', bucket: this.config.get('DVC_REMOTE_BUCKET') ?? null } }, worker: heartbeat ? { workerId: heartbeat.workerId, version: heartbeat.version, concurrency: heartbeat.concurrency, heartbeatAt: heartbeat.heartbeatAt, status: Date.now() - heartbeat.heartbeatAt.getTime() < 60_000 ? 'healthy' : 'unhealthy' } : { status: 'not_checked' } }; }
  @Roles(UserRole.ADMIN) @Patch('settings') update(@Body() body: UpdateSettingsDto, @CurrentUser() user: AuthUser) { return this.settings.update(body.values, user.id); }
}
