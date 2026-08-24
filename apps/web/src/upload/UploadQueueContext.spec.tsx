import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { UploadQueueProvider, useUploadQueue } from './UploadQueueContext';

vi.mock('../services/api', () => ({
  api: { files: vi.fn(), createUpload: vi.fn(), uploadPart: vi.fn(), completeUpload: vi.fn(), file: vi.fn(), abortUpload: vi.fn(), uploadSession: vi.fn(), job: vi.fn() },
}));

const fileRecord = { id: 'file-existing', originalName: 'existing.json' };

function Harness() {
  const queue = useUploadQueue();
  return <><button onClick={() => queue.addFiles([new File(['{}'], 'scan.json', { type: 'application/json', lastModified: 1 })])}>Add</button><button onClick={() => void queue.start({ robotId: 'robot-1', recognitionType: 'obstacle', schemaVersion: '1.0', capturedAtStrategy: 'NOW' })}>Start</button><button onClick={() => queue.items[0] && queue.retry(queue.items[0].id)}>Retry</button><output>{queue.items[0]?.status ?? 'EMPTY'}</output></>;
}

function renderQueue(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><UploadQueueProvider><Harness /></UploadQueueProvider></QueryClientProvider>) };
}

describe('UploadQueueProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'queue-1', subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } } });
  });

  it('marks a checksum match as duplicate without uploading and supports retry', async () => {
    vi.mocked(api.files).mockResolvedValue({ items: [fileRecord], total: 1, page: 1, pageSize: 1 } as never);
    renderQueue();
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Start'));

    expect(await screen.findByText('DUPLICATE')).toBeVisible();
    expect(api.createUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('QUEUED')).toBeVisible();
  });

  it('completes an observable upload and invalidates resource queries', async () => {
    vi.mocked(api.files).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });
    vi.mocked(api.createUpload).mockResolvedValue({ id: 'session-1', status: 'CREATED', originalName: 'scan.json', fileSize: '2', checksum: '0'.repeat(64), chunkSize: 8 * 1024 * 1024, totalParts: 1, expiresAt: new Date(Date.now() + 10000).toISOString(), parts: [] });
    vi.mocked(api.uploadPart).mockResolvedValue({ partNumber: 1 });
    vi.mocked(api.completeUpload).mockResolvedValue({ completed: true, robotFileId: 'new-file' });
    vi.mocked(api.file).mockResolvedValue({ id: 'new-file' } as never);
    const { client } = renderQueue(); const invalidate = vi.spyOn(client, 'invalidateQueries');
    fireEvent.click(screen.getByText('Add'));
    await act(async () => fireEvent.click(screen.getByText('Start')));

    await waitFor(() => expect(screen.getByText('COMPLETED')).toBeVisible());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['files'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });
});
