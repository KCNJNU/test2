import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('keeps process and gateway metrics scrapeable when database aggregation fails', async () => {
    const prisma = { $transaction: jest.fn().mockRejectedValue(new Error('postgresql://user:secret@db')) };
    const metrics = new MetricsService(prisma as never);
    metrics.gatewayConnected.set(1);

    const output = await metrics.render();

    expect(output).toContain('platform_device_gateway_connected{service="unknown"} 1');
    expect(output).toContain('platform_metrics_refresh_success{service="unknown"} 0');
    expect(output).not.toContain('secret');
    metrics.registry.clear();
  });
});
