import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, healthApiBase, request, setCsrfToken, unreachableHealth } from './api';

describe('API CSRF recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setCsrfToken();
  });

  it('refreshes the CSRF token once and retries a rejected upload part', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'CSRF_INVALID', message: 'Invalid CSRF token' }), { status: 403, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'user' }, csrfToken: 'fresh-token' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ partNumber: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetch);
    setCsrfToken('stale-token');

    await expect(request('/v1/uploads/session/parts/1', {
      method: 'PUT', body: new ArrayBuffer(1), headers: { 'Content-Range': 'bytes 0-0/1', 'X-Part-SHA256': 'a'.repeat(64) },
    })).resolves.toEqual({ partNumber: 1 });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(new Headers(fetch.mock.calls[2][1].headers).get('X-CSRF-Token')).toBe('fresh-token');
  });
});

describe('infrastructure health API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the dedicated NestJS health endpoint and preserves all D1 services', async () => {
    const services = {
      api: { status: 'healthy', message: 'ok' }, postgresql: { status: 'healthy', message: 'ok' },
      redis: { status: 'healthy', message: 'PONG' }, mqtt: { status: 'healthy', message: 'connected' },
      objectStorage: { status: 'healthy', message: 'ok' }, messageQueue: { status: 'healthy', message: 'ok' },
      dvcRemote: { status: 'not_checked', message: 'not configured' }, worker: { status: 'healthy', message: 'ok' },
      certificate: { status: 'healthy', message: 'ok' }, backup: { status: 'healthy', message: 'ok' },
      restoreDrill: { status: 'healthy', message: 'ok' }, retention: { status: 'not_checked', message: 'disabled' },
    };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'degraded', timestamp: '2026-08-23T00:00:00.000Z', services }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const result = await api.health();

    expect(fetch).toHaveBeenCalledWith(`${healthApiBase}/health`);
    expect(result.services.redis.status).toBe('healthy');
    expect(result.services.mqtt.status).toBe('healthy');
    expect(result.services.messageQueue.status).toBe('healthy');
    expect(result.services.dvcRemote.status).toBe('not_checked');
    expect(result.services.certificate.status).toBe('healthy');
    expect(result.services.backup.status).toBe('healthy');
  });

  it('maps fields absent from an older health response to not_checked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'healthy', services: { api: { status: 'healthy' }, postgresql: { status: 'healthy' } },
    }), { status: 200 })));

    const result = await api.health();

    expect(result.services.redis).toEqual({ status: 'not_checked', message: 'Not reported by the active API' });
    expect(result.services.mqtt.status).toBe('not_checked');
    expect(result.services.messageQueue.status).toBe('not_checked');
    expect(result.services.certificate.status).toBe('not_checked');
    expect(result.services.restoreDrill.status).toBe('not_checked');
  });

  it('distinguishes an unreachable health endpoint from dependencies that were not checked', () => {
    const result = unreachableHealth();
    expect(result.services.api.status).toBe('unhealthy');
    expect(result.services.redis.status).toBe('not_checked');
    expect(result.services.mqtt.status).toBe('not_checked');
  });
});

describe('observability summary API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the dedicated NestJS base URL with the authenticated session', async () => {
    const payload = { timestamp: '2026-08-23T00:00:00.000Z', fleet: { online: 2, offline: 1, running: 1, blocked: 0, fault: 0, safeEventsHour: 0 }, tasks: { running: 1, blocked: 0 }, commands: { sent: 1, accepted: 2, rejected: 0, timeout: 0, failed: 0 } };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(api.observabilitySummary()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(`${healthApiBase}/api/v1/observability/summary`, { credentials: 'include' });
  });

  it('reports an unavailable observability endpoint without inventing zero values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(api.observabilitySummary()).rejects.toThrow('Observability summary failed (503)');
  });
});
