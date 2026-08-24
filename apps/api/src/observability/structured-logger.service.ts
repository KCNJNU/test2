import { Injectable, LoggerService } from '@nestjs/common';
import { TraceContextService, TraceFields } from './trace-context.service';

type Level = 'debug' | 'log' | 'warn' | 'error' | 'verbose' | 'fatal';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(private readonly trace: TraceContextService) {}
  log(message: unknown, ...optional: unknown[]) { this.write('log', message, context(optional)); }
  fatal(message: unknown, ...optional: unknown[]) { this.write('fatal', message, context(optional)); }
  error(message: unknown, ...optional: unknown[]) { this.write('error', message, context(optional)); }
  warn(message: unknown, ...optional: unknown[]) { this.write('warn', message, context(optional)); }
  debug(message: unknown, ...optional: unknown[]) { this.write('debug', message, context(optional)); }
  verbose(message: unknown, ...optional: unknown[]) { this.write('verbose', message, context(optional)); }

  event(level: Level, message: string, fields: Partial<TraceFields> & Record<string, unknown> = {}) {
    this.write(level, message, undefined, fields);
  }

  private write(level: Level, message: unknown, loggerContext?: string, fields: Record<string, unknown> = {}) {
    const record = redact({
      timestamp: new Date().toISOString(), level, service: process.env.RUNTIME_SERVICE_NAME ?? 'unknown',
      instance: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'local', ...this.trace.get(), ...fields,
      context: loggerContext, message: printable(message),
    });
    const line = `${JSON.stringify(record)}\n`;
    if (level === 'error' || level === 'fatal') process.stderr.write(line); else process.stdout.write(line);
  }
}

function context(optional: unknown[]) { const last = optional.at(-1); return typeof last === 'string' ? last : undefined; }
function printable(value: unknown) { if (value instanceof Error) return value.message; if (typeof value === 'string') return value; try { return JSON.stringify(value); } catch { return String(value); } }
function redact(value: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|token|secret|authorization|private.?key/i.test(key)) result[key] = '[REDACTED]';
    else if (typeof item === 'string') result[key] = item.replace(/([?&](?:password|token|secret)=)[^&\s]+/gi, '$1[REDACTED]').replace(/:\/\/([^:/\s]+):([^@/\s]+)@/g, '://$1:[REDACTED]@');
    else result[key] = item;
  }
  return result;
}
