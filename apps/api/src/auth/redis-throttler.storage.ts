import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { createClient, RedisClientType } from 'redis';

const SCRIPT = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then return {0, redis.call('PTTL', KEYS[1]), 1, blocked} end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('PSETEX', KEYS[2], ARGV[3], '1')
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}`;
type ThrottlerStorageRecord = { totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number };

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private client?: RedisClientType;
  private connecting?: Promise<RedisClientType>;
  constructor(private readonly config: ConfigService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    try {
      const redis = await this.connection();
      const digest = createHash('sha256').update(`${this.config.getOrThrow<string>('RATE_LIMIT_KEY_SALT')}:${throttlerName}:${key}`).digest('hex');
      const result = await redis.eval(SCRIPT, { keys: [`throttle:${digest}`, `throttle-block:${digest}`], arguments: [String(ttl), String(limit), String(blockDuration || ttl)] }) as number[];
      return { totalHits: Number(result[0]), timeToExpire: Math.max(0, Number(result[1])), isBlocked: Number(result[2]) === 1, timeToBlockExpire: Math.max(0, Number(result[3])) };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ code: 'RATE_LIMIT_DEPENDENCY_UNAVAILABLE', message: 'Control operation is temporarily unavailable' });
    }
  }

  async onModuleDestroy() { if (this.client?.isOpen) await this.client.quit().catch(() => this.client?.destroy()); }

  private async connection() {
    if (this.client?.isReady) return this.client;
    if (!this.connecting) {
      const client = createClient({ socket: { host: this.config.getOrThrow<string>('REDIS_HOST'), port: Number(this.config.getOrThrow<string>('REDIS_PORT')), connectTimeout: 3_000, reconnectStrategy: false } });
      client.on('error', () => undefined);
      this.client = client as RedisClientType;
      this.connecting = client.connect().then(() => this.client!);
    }
    try { return await this.connecting; }
    catch { this.connecting = undefined; this.client?.destroy(); this.client = undefined; throw new ServiceUnavailableException({ code: 'RATE_LIMIT_DEPENDENCY_UNAVAILABLE', message: 'Control operation is temporarily unavailable' }); }
  }
}
