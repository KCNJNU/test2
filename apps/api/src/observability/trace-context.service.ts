import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TraceFields = { traceId: string; requestId?: string; userId?: string; robotId?: string; taskId?: string; commandId?: string };

@Injectable()
export class TraceContextService {
  private readonly storage = new AsyncLocalStorage<TraceFields>();
  run<T>(fields: TraceFields, callback: () => T) { return this.storage.run(fields, callback); }
  get() { return this.storage.getStore(); }
  update(fields: Partial<TraceFields>) { const current = this.storage.getStore(); if (current) Object.assign(current, fields); }
}
