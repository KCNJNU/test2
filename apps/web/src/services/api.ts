export type Robot = { id: string; name: string; externalId?: string | null; metadata?: unknown; createdAt: string };
export type RobotFile = { id: string; robotId: string; objectKey: string; originalName: string; fileType: string; mimeType: string; fileSize: string; checksum: string; recognitionType: string; schemaVersion: string; capturedAt: string; metadata?: unknown; createdAt: string };
export type FilePage = { items: RobotFile[]; total: number; page: number; pageSize: number };
export type DatasetVersion = { id: string; datasetId: string; version: number; status: 'DRAFT' | 'FROZEN' | 'PUBLISHED' | 'ARCHIVED'; manifestKey?: string | null; manifestChecksum?: string | null; fileCount: number; totalSize: string; gitCommit?: string | null; gitTag?: string | null; dvcPath?: string | null; dvcHash?: string | null; createdAt: string; frozenAt?: string | null; files?: Array<{ robotFileId: string; robotFile: RobotFile }> };
export type Dataset = { id: string; name: string; description?: string | null; metadata?: unknown; createdAt: string; versions: DatasetVersion[] };

const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers } });
  if (!response.ok) { const body = await response.json().catch(() => ({ message: response.statusText })); throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? response.statusText); }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const api = {
  health: () => fetch(`${base}/health`).then((r) => r.json() as Promise<{ status: string }>),
  robots: () => request<Robot[]>('/v1/robots'),
  files: (query: Record<string, string | number | undefined>) => request<FilePage>(`/v1/files?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`),
  file: (id: string) => request<RobotFile>(`/v1/files/${id}`),
  download: (id: string) => request<{ url: string }>(`/v1/files/${id}/download`),
  deleteFile: (id: string) => request<void>(`/v1/files/${id}`, { method: 'DELETE' }),
  upload: (data: FormData) => request<RobotFile>('/v1/files', { method: 'POST', body: data }),
  datasets: () => request<Dataset[]>('/v1/datasets'),
  dataset: (id: string) => request<Dataset>(`/v1/datasets/${id}`),
  createDataset: (data: { name: string; description?: string }) => request<Dataset>('/v1/datasets', { method: 'POST', body: JSON.stringify(data) }),
  createVersion: (id: string, fileIds: string[]) => request<DatasetVersion>(`/v1/datasets/${id}/versions`, { method: 'POST', body: JSON.stringify({ fileIds }) }),
  version: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}`),
  addFiles: (id: string, fileIds: string[]) => request<DatasetVersion>(`/v1/datasets/versions/${id}/files`, { method: 'POST', body: JSON.stringify({ fileIds }) }),
  removeFile: (versionId: string, fileId: string) => request<void>(`/v1/datasets/versions/${versionId}/files/${fileId}`, { method: 'DELETE' }),
  freeze: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}/freeze`, { method: 'POST' }),
  publish: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}/publish`, { method: 'POST' }),
};
