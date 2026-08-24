import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const SETTING_DEFAULTS = {
  'upload.jsonMaxBytes': 50 * 1024 * 1024,
  'upload.imageMaxBytes': 100 * 1024 * 1024,
  'upload.pcdMaxBytes': 2 * 1024 * 1024 * 1024,
  'upload.mapMaxBytes': 100 * 1024 * 1024,
  'upload.yamlMaxBytes': 10 * 1024 * 1024,
  'upload.logMaxBytes': 2 * 1024 * 1024 * 1024,
  'download.presignedTtlSeconds': 900,
  'jobs.workerConcurrency': 2,
  'notifications.jobSuccessEnabled': true,
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async all() { const rows = await this.prisma.systemSetting.findMany(); const stored = new Map(rows.map((row) => [row.key, row.value])); return Object.fromEntries(Object.entries(SETTING_DEFAULTS).map(([key, value]) => [key, stored.get(key) ?? value])); }
  async get<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> { const row = await this.prisma.systemSetting.findUnique({ where: { key } }); return (row?.value ?? SETTING_DEFAULTS[key]) as (typeof SETTING_DEFAULTS)[K]; }
  async update(values: Record<string, unknown>, userId: string) {
    const entries = Object.entries(values);
    for (const [key, value] of entries) this.validate(key, value);
    await this.prisma.$transaction(entries.map(([key, value]) => this.prisma.systemSetting.upsert({ where: { key }, update: { value: value as Prisma.InputJsonValue, updatedById: userId }, create: { key, value: value as Prisma.InputJsonValue, updatedById: userId } })));
    return this.all();
  }
  private validate(key: string, value: unknown) {
    if (!(key in SETTING_DEFAULTS)) throw new BadRequestException(`Unsupported setting: ${key}`);
    const expected = SETTING_DEFAULTS[key as SettingKey];
    if (typeof value !== typeof expected) throw new BadRequestException(`Invalid setting type: ${key}`);
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestException(`Invalid setting value: ${key}`);
      if (key === 'jobs.workerConcurrency' && value > 8) throw new BadRequestException('Worker concurrency must be between 1 and 8');
      if (key === 'download.presignedTtlSeconds' && (value < 60 || value > 3600)) throw new BadRequestException('Download TTL must be between 60 and 3600 seconds');
      if (key.startsWith('upload.') && value > 2 * 1024 * 1024 * 1024) throw new BadRequestException('Upload limit cannot exceed 2 GiB');
    }
  }
}
