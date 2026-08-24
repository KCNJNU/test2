import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('RedisThrottlerStorage', () => {
  const client = { on: jest.fn(), connect: jest.fn(), eval: jest.fn(), quit: jest.fn(), destroy: jest.fn(), isReady: false, isOpen: true };
  const config = { getOrThrow: jest.fn((key: string) => ({ REDIS_HOST: 'localhost', REDIS_PORT: '6379', RATE_LIMIT_KEY_SALT: 'test-only-salt' })[key]) } as unknown as ConfigService;

  beforeEach(() => { jest.clearAllMocks(); jest.mocked(createClient).mockReturnValue(client as never); client.connect.mockResolvedValue(client); client.eval.mockResolvedValue([1, 60_000, 0, 0]); });

  it('stores only a salted digest and returns the distributed counter state', async () => {
    const storage = new RedisThrottlerStorage(config);
    await expect(storage.increment('192.0.2.4:person@example.com', 60_000, 10, 60_000, 'login')).resolves.toEqual({ totalHits: 1, timeToExpire: 60_000, isBlocked: false, timeToBlockExpire: 0 });
    const options = client.eval.mock.calls[0][1] as { keys: string[] };
    expect(options.keys.join(':')).not.toMatch(/person|192\.0\.2\.4/);
  });

  it('fails closed with a safe 503 when Redis cannot connect', async () => {
    client.connect.mockRejectedValue(new Error('redis://user:secret@internal'));
    const storage = new RedisThrottlerStorage(config);
    await expect(storage.increment('identity', 60_000, 10, 60_000, 'login')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
