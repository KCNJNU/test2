import { TraceContextService } from './trace-context.service';
import { TraceMiddleware } from './trace.middleware';

describe('TraceMiddleware', () => {
  it('continues a valid W3C trace and returns correlation headers', () => {
    const context = new TraceContextService();
    const middleware = new TraceMiddleware(context);
    const request = { headers: {}, header: (name: string) => ({ traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01', 'x-request-id': 'request-1' })[name] } as never;
    const headers: Record<string, string> = {};
    const response = { setHeader: (name: string, value: string) => { headers[name] = value; } } as never;

    middleware.use(request, response, () => expect(context.get()).toEqual({ requestId: 'request-1', traceId: '0123456789abcdef0123456789abcdef' }));

    expect(headers).toMatchObject({ 'x-request-id': 'request-1', 'x-trace-id': '0123456789abcdef0123456789abcdef' });
  });

  it('replaces malformed external identifiers with bounded generated values', () => {
    const context = new TraceContextService();
    const middleware = new TraceMiddleware(context);
    const request = { headers: {}, header: () => 'not-a-valid-trace' } as never;
    const response = { setHeader: jest.fn() } as never;
    middleware.use(request, response, () => expect(context.get()?.traceId).toMatch(/^[0-9a-f]{32}$/));
  });
});
