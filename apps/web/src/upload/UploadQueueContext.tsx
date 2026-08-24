import { useQueryClient } from '@tanstack/react-query';
import { createSHA256 } from 'hash-wasm';
import { openDB } from 'idb';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type RobotFile, type UploadInput } from '../services/api';

const CHUNK_SIZE = 8 * 1024 * 1024;
export type UploadStatus = 'QUEUED' | 'HASHING' | 'CHECKING_DUPLICATE' | 'UPLOADING' | 'FINALIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DUPLICATE';
export type UploadQueueItem = { id: string; file?: File; fileName: string; fileSize: number; lastModified: number; mimeType: string; status: UploadStatus; progress: number; checksum?: string; uploadSessionId?: string; error?: string; result?: RobotFile; existing?: RobotFile };
export type UploadDefaults = Omit<UploadInput, 'file' | 'capturedAt'> & { capturedAtStrategy: 'NOW' | 'LAST_MODIFIED' | 'CUSTOM'; capturedAt?: string };
type UploadQueueValue = { items: UploadQueueItem[]; addFiles: (files: File[]) => void; start: (defaults: UploadDefaults) => Promise<void>; cancel: (id: string) => void; retry: (id: string) => void; remove: (id: string) => void; clearCompleted: () => void };
const UploadQueueContext = createContext<UploadQueueValue | null>(null);
const database = typeof indexedDB === 'undefined' ? undefined : openDB('robot-platform-upload-sessions', 1, { upgrade(db) { db.createObjectStore('queue', { keyPath: 'id' }); } });

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadQueueItem[]>([]); const active = useRef(new Map<string, AbortController>()); const queryClient = useQueryClient();
  useEffect(() => { if (database) void database.then((db) => db.getAll('queue')).then((saved: UploadQueueItem[]) => setItems(saved.map((item) => ({ ...item, file: undefined, status: item.status === 'COMPLETED' ? 'COMPLETED' : 'QUEUED', error: item.status === 'COMPLETED' ? undefined : 'Reselect the same file to resume this upload' })))); }, []);
  const update = useCallback((id: string, patch: Partial<UploadQueueItem>) => setItems((current) => current.map((item) => { if (item.id !== id) return item; const next = { ...item, ...patch }; void persist(next); return next; })), []);
  const addFiles = useCallback((files: File[]) => setItems((current) => { const next = [...current]; for (const file of files) { const existing = next.find((item) => item.fileName === file.name && item.fileSize === file.size && item.lastModified === file.lastModified); if (existing) { Object.assign(existing, { file, mimeType: file.type || existing.mimeType, error: undefined, status: existing.status === 'COMPLETED' ? 'COMPLETED' : 'QUEUED' }); void persist(existing); } else { const item: UploadQueueItem = { id: crypto.randomUUID(), file, fileName: file.name, fileSize: file.size, lastModified: file.lastModified, mimeType: file.type || 'application/octet-stream', status: 'QUEUED', progress: 0 }; next.push(item); void persist(item); } } return next; }), []);

  const process = useCallback(async (item: UploadQueueItem, defaults: UploadDefaults) => {
    if (!item.file) { update(item.id, { status: 'FAILED', error: 'Reselect the original file before resuming' }); return; }
    const controller = new AbortController(); active.current.set(item.id, controller);
    try {
      update(item.id, { status: 'HASHING', progress: 0, error: undefined }); const checksum = await incrementalSha256(item.file, controller.signal, (value) => update(item.id, { progress: Math.round(value * 15) }));
      if (item.checksum && item.checksum !== checksum) throw new Error('Reselected file checksum does not match the saved upload session');
      update(item.id, { status: 'CHECKING_DUPLICATE', checksum, progress: 16 }); const duplicate = await api.files({ checksum, page: 1, pageSize: 1 });
      if (duplicate.items[0]) { update(item.id, { status: 'DUPLICATE', existing: duplicate.items[0], progress: 100 }); return; }
      const capturedAt = defaults.capturedAtStrategy === 'LAST_MODIFIED' ? new Date(item.file.lastModified).toISOString() : defaults.capturedAt || new Date().toISOString();
      let session = item.uploadSessionId ? await api.uploadSession(item.uploadSessionId) : undefined;
      if (!session || ['ABORTED', 'EXPIRED'].includes(session.status)) session = await api.createUpload({ robotId: defaults.robotId, originalName: item.file.name, mimeType: item.file.type || 'application/octet-stream', fileSize: item.file.size, checksum, recognitionType: defaults.recognitionType, schemaVersion: defaults.schemaVersion, capturedAt, metadata: defaults.metadata, lastModified: item.file.lastModified });
      update(item.id, { uploadSessionId: session.id, status: 'UPLOADING', progress: 17 }); const completed = new Set(session.parts.map((part) => part.partNumber));
      for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
        if (controller.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError'); const start = (partNumber - 1) * session.chunkSize; const endExclusive = Math.min(item.file.size, start + session.chunkSize);
        if (!completed.has(partNumber)) { const bytes = await item.file.slice(start, endExclusive).arrayBuffer(); const partHash = await crypto.subtle.digest('SHA-256', bytes); const digest = hex(new Uint8Array(partHash)); await api.uploadPart(session.id, partNumber, bytes, start, endExclusive - 1, item.file.size, digest, controller.signal); }
        update(item.id, { progress: 17 + Math.round(endExclusive / item.file.size * 73) });
      }
      update(item.id, { status: 'FINALIZING', progress: 90 });
      const completion = await api.completeUpload(session.id); let robotFileId: string;
      if ('completed' in completion) robotFileId = completion.robotFileId; else { const final = await waitForJob(completion.id, controller.signal, (progress) => update(item.id, { progress: 90 + Math.round(progress / 10) })); if (final.status !== 'SUCCEEDED') throw new Error(final.errorMessage ?? `Finalize job ${final.status.toLowerCase()}`); robotFileId = String((final as unknown as { result?: { robotFileId?: string } }).result?.robotFileId ?? ''); }
      const result = robotFileId ? await api.file(robotFileId) : undefined; update(item.id, { status: 'COMPLETED', result, progress: 100 });
      await Promise.all(['files', 'dashboard', 'robots', 'search', 'jobs'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (reason) { if (reason instanceof DOMException && reason.name === 'AbortError') update(item.id, { status: 'CANCELLED', error: undefined }); else update(item.id, { status: 'FAILED', error: reason instanceof Error ? reason.message : 'Upload failed' }); }
    finally { active.current.delete(item.id); }
  }, [queryClient, update]);

  const start = useCallback(async (defaults: UploadDefaults) => { const queue = items.filter((item) => item.status === 'QUEUED'); let cursor = 0; const worker = async () => { while (cursor < queue.length) await process(queue[cursor++], defaults); }; await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker)); }, [items, process]);
  const cancel = useCallback((id: string) => { active.current.get(id)?.abort(); const item = items.find((value) => value.id === id); if (item?.uploadSessionId) void api.abortUpload(item.uploadSessionId).catch(() => undefined); update(id, { status: 'CANCELLED' }); }, [items, update]);
  const retry = useCallback((id: string) => update(id, { status: 'QUEUED', progress: 0, error: undefined, existing: undefined }), [update]);
  const remove = useCallback((id: string) => { setItems((current) => current.filter((item) => item.id !== id)); if (database) void database.then((db) => db.delete('queue', id)); }, []);
  const clearCompleted = useCallback(() => setItems((current) => { const removed = current.filter((item) => ['COMPLETED', 'CANCELLED', 'DUPLICATE'].includes(item.status)); if (database) void database.then((db) => Promise.all(removed.map((item) => db.delete('queue', item.id)))); return current.filter((item) => !removed.includes(item)); }), []);
  return <UploadQueueContext.Provider value={useMemo(() => ({ items, addFiles, start, cancel, retry, remove, clearCompleted }), [items, addFiles, start, cancel, retry, remove, clearCompleted])}>{children}</UploadQueueContext.Provider>;
}

async function persist(item: UploadQueueItem) { if (!database) return; const descriptor = { ...item }; delete descriptor.file; delete descriptor.existing; delete descriptor.result; await (await database).put('queue', descriptor); }
async function incrementalSha256(file: File, signal: AbortSignal, progress: (value: number) => void) { const hasher = await createSHA256(); hasher.init(); for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) { if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError'); hasher.update(new Uint8Array(await file.slice(offset, Math.min(file.size, offset + CHUNK_SIZE)).arrayBuffer())); progress(Math.min(1, (offset + CHUNK_SIZE) / file.size)); } return hasher.digest('hex'); }
async function waitForJob(id: string, signal: AbortSignal, progress: (value: number) => void) {
  const queuedDeadline = Date.now() + 30_000;
  for (;;) {
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');
    const job = await api.job(id); progress(job.progress);
    if (!['QUEUED', 'RUNNING'].includes(job.status)) return job;
    if (job.status === 'QUEUED' && Date.now() >= queuedDeadline) throw new Error('Finalization is waiting for the operations worker. Restart the API development service or run the worker, then retry.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
function hex(value: Uint8Array) { return Array.from(value).map((item) => item.toString(16).padStart(2, '0')).join(''); }
// eslint-disable-next-line react-refresh/only-export-components
export function useUploadQueue() { const value = useContext(UploadQueueContext); if (!value) throw new Error('UploadQueueProvider is missing'); return value; }
