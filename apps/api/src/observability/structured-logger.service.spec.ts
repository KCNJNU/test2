import { StructuredLoggerService } from './structured-logger.service';
import { TraceContextService } from './trace-context.service';

describe('StructuredLoggerService', () => {
  it('emits correlation fields and redacts credentials', () => {
    const trace = new TraceContextService();
    const logger = new StructuredLoggerService(trace);
    const output = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    trace.run({ traceId: 'a'.repeat(32), requestId: 'request-1' }, () => logger.event('log', 'probe', {
      robotId: 'robot-1', password: 'do-not-log', endpoint: 'mqtt://user:pass@broker:1883?token=abc',
    }));

    const record = JSON.parse(String(output.mock.calls[0][0]));
    expect(record).toMatchObject({ traceId: 'a'.repeat(32), requestId: 'request-1', robotId: 'robot-1', password: '[REDACTED]' });
    expect(record.endpoint).not.toContain('pass');
    expect(record.endpoint).not.toContain('abc');
    output.mockRestore();
  });
});
