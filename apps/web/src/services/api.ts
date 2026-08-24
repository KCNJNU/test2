export type ActivityStatus = 'ACTIVE' | 'IDLE' | 'NO_DATA';
export type RobotStats = { lastUpload: string | null; files24h: number; totalFiles: number; totalBytes: string; recognitionTypes: string[]; activityStatus: ActivityStatus };
export type Robot = { id: string; name: string; externalId?: string | null; metadata?: unknown; createdAt: string; updatedAt: string; stats?: RobotStats };
export type RobotPage = { items: Robot[]; total: number; page: number; pageSize: number };
export type RobotDetail = Robot & { stats: RobotStats; recentFiles: Array<Pick<RobotFile, 'id' | 'originalName' | 'fileType' | 'fileSize' | 'recognitionType' | 'capturedAt' | 'createdAt'>>; datasets: Array<{ id: string; name: string; versions: Array<Pick<DatasetVersion, 'id' | 'version' | 'status'>> }> };
export type RobotSummary = Pick<Robot, 'id' | 'name' | 'externalId'>;
export type RobotFile = { id: string; robotId: string; objectKey: string; originalName: string; fileType: string; mimeType: string; fileSize: string; checksum: string; recognitionType: string; schemaVersion: string; capturedAt: string; metadata?: unknown; createdAt: string; updatedAt: string; robot?: RobotSummary; tags?: Array<{ tag: Tag }>; datasetFiles?: Array<{ datasetVersionId: string; datasetVersion: DatasetVersion & { dataset: Pick<Dataset, 'id' | 'name'> } }> };
export type UserRole = 'ADMIN' | 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'PROJECT_ADMIN' | 'OPERATOR' | 'MAINTENANCE_ENGINEER' | 'VIEWER';
export type AuthUser = { id: string; email: string; displayName: string; role: UserRole; tenantId?: string; projectIds?: string[]; mustChangePassword: boolean };
export type PlatformRobot = { id: string; robotSn: string; robotName: string; projectId?: string; projectName?: string; siteName?: string; floorName?: string; onlineStatus: 'ONLINE' | 'UNSTABLE' | 'OFFLINE'; operationalState: string; safetyCode?: string | null; batteryPercent?: number | null; chargingState?: string | null; currentTaskId?: string | null; lastOnlineAt?: string | null; lastTelemetryAt?: string | null };
export type PlatformTask = { id: string; projectId: string; robotId: string; name: string; status: string; scheduledAt?: string | null; currentProgress?: number | null; lastStatusAt?: string | null };
export type PlatformPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type PlatformMap = { id: string; tenantId: string; projectId: string; floorId: string; floorName?: string; name: string; status: string; createdAt: string; updatedAt: string };
export type PlatformMapVersion = { id: string; version: number; status: 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'ARCHIVED'; mapObjectKey: string; mimeType: string; checksum: string; validation?: unknown; publishedAt?: string | null; createdAt: string };
export type PlatformZone = { id: string; mapVersionId: string; type: string; name: string; geometry: { type: 'Point' | 'Polygon'; coordinates: unknown }; properties?: Record<string, unknown> };
export type PlatformMapDetail = { map: PlatformMap; versions: PlatformMapVersion[] };
export type Tag = { id: string; name: string; color: string; _count?: { robotFiles: number; datasets: number } };
export type FilePage = { items: RobotFile[]; total: number; page: number; pageSize: number };
export type FileQuery = Record<string, string | number | undefined>;
export type DatasetVersion = { id: string; datasetId: string; version: number; status: 'DRAFT' | 'FROZEN' | 'PUBLISHED' | 'ARCHIVED'; manifestKey?: string | null; manifestChecksum?: string | null; fileCount: number; totalSize: string; gitCommit?: string | null; gitTag?: string | null; dvcPath?: string | null; dvcHash?: string | null; createdAt: string; updatedAt: string; frozenAt?: string | null; files?: Array<{ robotFileId: string; robotFile: RobotFile }> };
export type Dataset = { id: string; name: string; description?: string | null; metadata?: unknown; createdAt: string; updatedAt: string; versions: DatasetVersion[] };
export type DatasetPageItem = Dataset & { latestVersion: DatasetVersion | null; versionCount: number };
export type DatasetPage = { items: DatasetPageItem[]; total: number; page: number; pageSize: number };
export type VersionPageItem = DatasetVersion & { dataset: Pick<Dataset, 'id' | 'name'> };
export type VersionPage = { items: VersionPageItem[]; total: number; page: number; pageSize: number };
export type ValidationIssue = { code: string; severity: 'error' | 'warning'; message: string; fileId?: string; objectKey?: string };
export type ValidationReport = { versionId: string; status: DatasetVersion['status']; valid: boolean; validatedAt: string; summary: { files: number; totalSize: string; checkedObjects: number; errors: number; warnings: number }; issues: ValidationIssue[] };
export type CompareFile = Pick<RobotFile, 'id' | 'originalName' | 'checksum' | 'recognitionType' | 'schemaVersion' | 'capturedAt' | 'fileSize'> & { robot: RobotSummary };
export type VersionComparison = { dataset: Pick<Dataset, 'id' | 'name'>; base: Pick<DatasetVersion, 'id' | 'version' | 'status' | 'fileCount' | 'totalSize'>; target: Pick<DatasetVersion, 'id' | 'version' | 'status' | 'fileCount' | 'totalSize'>; summary: { added: number; removed: number; unchanged: number; totalSizeDelta: string }; files: { added: CompareFile[]; removed: CompareFile[]; unchanged: CompareFile[] } };
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'not_checked';
export type ServiceHealth = { status: HealthStatus; message: string; provider?: string; bucket?: string };
export type Health = { status: HealthStatus; timestamp: string; services: { api: ServiceHealth; postgresql: ServiceHealth; redis: ServiceHealth; mqtt: ServiceHealth; objectStorage: ServiceHealth; messageQueue: ServiceHealth; dvcRemote: ServiceHealth; worker: ServiceHealth; certificate: ServiceHealth; backup: ServiceHealth; restoreDrill: ServiceHealth; retention: ServiceHealth } };
export type ObservabilitySummary = { timestamp: string; fleet: { online: number; offline: number; running: number; blocked: number; fault: number; safeEventsHour: number }; tasks: { running: number; blocked: number }; commands: { sent: number; accepted: number; rejected: number; timeout: number; failed: number } };
export type DashboardData = { rangeDays: number; summary: { robots: number; files: number; managedBytes: string; datasets: number; publishedVersions: number; jobs: { status: 'enabled'; active: number; total: number; byStatus: Record<string, number> } }; ingestion: Array<{ date: string; fileCount: number; bytes: string }>; robotActivity: Array<RobotStats & Pick<Robot, 'id' | 'name' | 'externalId'>>; pipeline: Record<DatasetVersion['status'], number>; recent: Array<{ type: 'file' | 'dataset' | 'version' | 'job'; id: string; label: string; action: string; timestamp: string }> };
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type Job = { id: string; type: 'DATASET_PUBLISH' | 'RECOVERY_VERIFY' | 'STORAGE_SCAN' | 'STORAGE_ORPHAN_DELETE' | 'UPLOAD_FINALIZE' | 'RETENTION_CLEANUP'; status: JobStatus; progress: number; resourceType?: string; resourceId?: string; errorMessage?: string; cancelRequested: boolean; createdAt: string; updatedAt: string; startedAt?: string; finishedAt?: string; steps: Array<{ id: string; name: string; stepOrder: number; status: string; progress: number; errorMessage?: string; startedAt?: string; finishedAt?: string }> };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ResumableUpload = { id: string; status: string; originalName: string; fileSize: string; checksum: string; chunkSize: number; totalParts: number; robotFileId?: string; expiresAt: string; parts: Array<{ partNumber: number; size: number; checksum: string }> };
export type SearchItem = { type: 'robot' | 'file' | 'dataset' | 'version'; id: string; title: string; subtitle: string; datasetId?: string };
export type SearchResult = { query: string; groups: { robots: SearchItem[]; files: SearchItem[]; datasets: SearchItem[]; versions: SearchItem[] } };
export type OtaSoftwareVersion = { id: string; component: string; version: string; mimeType: string; fileSize: number | string; checksum: string; signed: boolean; status: string; hardwareModels: string[]; minBatteryPercent: number; releaseNotes?: string; verifiedAt?: string; createdAt: string };
export type OtaConfigVersion = { id: string; tenantId: string; projectId?: string; category: 'BUSINESS' | 'CLEANING' | 'NAVIGATION' | 'SAFETY'; version: string; checksum: string; content: Record<string, unknown>; reason: string; approvalStatus: string; createdById?: string; approvedById?: string; approvedAt?: string; rollbackVersionId?: string; createdAt: string };
export type OtaCampaign = { id: string; tenantId: string; projectId: string; softwareVersionId?: string; configVersionId?: string; strategy: 'SINGLE' | 'SELECTED_BATCH' | 'PERCENTAGE' | 'PROJECT'; percentage?: number; status: string; reason: string; targetCount: number; eligibleCount: number; blockedCount: number; startedAt?: string; finishedAt?: string; createdAt: string };
export type OtaJob = { id: string; campaignId?: string; robotId: string; softwareVersionId?: string; configVersionId?: string; status: string; progress: number; targetChecksum?: string; previousVersion?: string; rollbackVersion?: string; rollbackStatus?: string; failureReason?: string; rollbackReason?: string; createdAt: string; updatedAt: string };

const serviceMap = (status: HealthStatus, message: string): Health['services'] => ({
  api: { status, message }, postgresql: { status, message }, redis: { status, message }, mqtt: { status, message },
  objectStorage: { status, message }, messageQueue: { status, message }, dvcRemote: { status, message }, worker: { status, message },
  certificate: { status, message }, backup: { status, message }, restoreDrill: { status, message }, retention: { status, message },
});
export const pendingHealth = (): Health => ({ status: 'not_checked', timestamp: '', services: serviceMap('not_checked', 'Health check pending') });
export const unreachableHealth = (): Health => {
  const message = 'Not checked because the health endpoint is unreachable';
  const services = serviceMap('not_checked', message);
  services.api = { status: 'unhealthy', message: 'Health endpoint is not reachable' };
  return { status: 'unhealthy', timestamp: new Date().toISOString(), services };
};

type PartialHealth = Partial<Omit<Health, 'services'>> & { services?: Partial<Record<keyof Health['services'], Partial<ServiceHealth>>> };
function normalizeHealth(value: PartialHealth): Health {
  const fallback = pendingHealth();
  const service = (name: keyof Health['services']): ServiceHealth => ({
    ...fallback.services[name],
    ...value.services?.[name],
    message: value.services?.[name]?.message ?? (value.services?.[name] ? 'Service is healthy' : 'Not reported by the active API'),
  });
  return {
    status: value.status ?? fallback.status,
    timestamp: value.timestamp ?? new Date().toISOString(),
    services: {
      api: service('api'), postgresql: service('postgresql'), redis: service('redis'), mqtt: service('mqtt'),
      objectStorage: service('objectStorage'), messageQueue: service('messageQueue'), dvcRemote: service('dvcRemote'), worker: service('worker'),
      certificate: service('certificate'), backup: service('backup'), restoreDrill: service('restoreDrill'), retention: service('retention'),
    },
  };
}

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3100';
export const healthApiBase = import.meta.env.VITE_HEALTH_API_BASE_URL ?? 'http://localhost:3000';
let csrfToken: string | undefined;
let csrfRefresh: Promise<void> | undefined;
export function setCsrfToken(value?: string) { csrfToken = value; }
export class ApiError extends Error { constructor(message: string, readonly status: number, readonly payload?: unknown) { super(message); } }
export async function request<T>(path: string, init?: RequestInit, allowCsrfRetry = true): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = init?.body;
  const needsJsonContentType = body != null && !(body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer);
  const response = await fetch(`${apiBase}/api${path}`, { ...init, credentials: 'include', headers: { ...(needsJsonContentType ? { 'Content-Type': 'application/json' } : {}), ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...init?.headers } });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
    if (response.status === 403 && allowCsrfRetry && !['GET', 'HEAD', 'OPTIONS'].includes(method) && isCsrfFailure(errorBody)) {
      await refreshCsrfToken();
      return request<T>(path, init, false);
    }
    throw new ApiError(Array.isArray(errorBody.message) ? errorBody.message.join(', ') : errorBody.message ?? response.statusText, response.status, errorBody);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
function isCsrfFailure(body: { code?: string; message?: string | string[] }) {
  const message = Array.isArray(body.message) ? body.message.join(' ') : body.message ?? '';
  return body.code === 'CSRF_INVALID' || /csrf/i.test(message);
}
async function refreshCsrfToken() {
  csrfRefresh ??= (async () => {
    const response = await fetch(`${apiBase}/api/v1/auth/session`, { credentials: 'include' });
    const body = await response.json().catch(() => ({ message: response.statusText }));
    if (!response.ok) throw new ApiError(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? response.statusText, response.status, body);
    setCsrfToken((body as { csrfToken?: string }).csrfToken);
  })().finally(() => { csrfRefresh = undefined; });
  return csrfRefresh;
}
const queryString = (query: FileQuery) => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString();

async function getAllFiles() {
  const first = await request<FilePage>('/v1/files?page=1&pageSize=100');
  if (first.items.length >= first.total) return first.items;
  const remainingPages = Math.ceil(first.total / 100) - 1;
  const pages = await Promise.all(Array.from({ length: remainingPages }, (_, index) => request<FilePage>(`/v1/files?page=${index + 2}&pageSize=100`)));
  return [first, ...pages].flatMap((page) => page.items);
}

export type UploadInput = { file: File; robotId: string; recognitionType: string; schemaVersion: string; capturedAt: string; metadata?: Record<string, unknown> };
export function uploadWithProgress(input: UploadInput, onProgress: (percent: number) => void) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<RobotFile>((resolve, reject) => {
    const form = new FormData();
    form.append('robotId', input.robotId); form.append('recognitionType', input.recognitionType); form.append('schemaVersion', input.schemaVersion); form.append('capturedAt', input.capturedAt);
    if (input.metadata && Object.keys(input.metadata).length) form.append('metadata', JSON.stringify(input.metadata));
    form.append('file', input.file);
    xhr.open('POST', `${apiBase}/api/v1/files`);
    xhr.withCredentials = true;
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100));
    xhr.onload = () => { const body = safeJson(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(body as RobotFile); else reject(new Error(extractMessage(body, xhr.statusText))); };
    xhr.onerror = () => reject(new Error('Upload connection failed'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    xhr.send(form);
  });
  return { promise, cancel: () => xhr.abort() };
}
function safeJson(value: string): unknown { try { return JSON.parse(value); } catch { return {}; } }
function extractMessage(body: unknown, fallback: string) { const message = (body as { message?: string | string[] })?.message; return Array.isArray(message) ? message.join(', ') : message ?? fallback; }

export const api = {
  health: async () => { const response = await fetch(`${healthApiBase}/health`); if (!response.ok) throw new Error(`Health check failed (${response.status})`); return normalizeHealth(await response.json() as PartialHealth); },
  observabilitySummary: async () => { const response = await fetch(`${healthApiBase}/api/v1/observability/summary`, { credentials: 'include' }); if (!response.ok) throw new Error(`Observability summary failed (${response.status})`); return response.json() as Promise<ObservabilitySummary>; },
  dashboard: (days: 1 | 7 | 30) => request<DashboardData>(`/v1/dashboard?days=${days}`),
  login: (email: string, password: string) => request<{ user: AuthUser; csrfToken: string; expiresAt: string }>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  session: () => request<{ user: AuthUser; csrfToken: string }>('/v1/auth/session'),
  logout: () => request<{ success: boolean }>('/v1/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) => request<{ success: boolean; reauthenticate: boolean }>('/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  search: (q: string, limit = 5) => request<SearchResult>(`/v1/search?${queryString({ q, limit })}`),
  robots: async () => {
    const result = await request<Robot[] | PlatformPage<PlatformRobot>>('/v1/robots');
    if (Array.isArray(result)) return result;
    return result.items.map((robot) => ({ id: robot.id, name: robot.robotName, externalId: robot.robotSn, createdAt: '', updatedAt: robot.lastTelemetryAt ?? robot.lastOnlineAt ?? '' }));
  },
  platformRobots: () => request<PlatformPage<PlatformRobot>>('/v1/robots'),
  platformTasks: () => request<PlatformPage<PlatformTask>>('/v1/tasks'),
  platformCreateTask: (data: Record<string, unknown>) => request<PlatformTask>('/v1/tasks', { method: 'POST', body: JSON.stringify(data) }),
  platformTaskAction: (id: string, action: 'start' | 'pause' | 'resume' | 'cancel', idempotencyKey = crypto.randomUUID()) => request<Record<string, unknown>>(`/v1/tasks/${id}/${action}`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } }),
  platformMaps: () => request<PlatformPage<PlatformMap>>('/v1/maps'),
  platformMap: (id: string) => request<PlatformMapDetail>(`/v1/maps/${id}`),
  platformMapZones: (id: string, versionId: string) => request<PlatformPage<PlatformZone>>(`/v1/maps/${id}/zones?${queryString({ versionId })}`),
  publishPlatformMap: (id: string, versionId: string, reason: string) => request<{ mapId: string; versionId: string; status: 'PUBLISHED' }>(`/v1/maps/${id}/publish`, { method: 'POST', body: JSON.stringify({ versionId, reason }) }),
  platformPage: <T = Record<string, unknown>>(path: string) => request<PlatformPage<T>>(`/v1/${path}`),
  platformResource: <T = Record<string, unknown>>(path: string) => request<T>(`/v1/${path}`),
  acknowledgeFault: (id: string, note: string) => request<Record<string, unknown>>(`/v1/faults/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }),
  createOta: (data: Record<string, unknown>) => request<Record<string, unknown>>('/v1/ota', { method: 'POST', body: JSON.stringify(data) }),
  softwareVersions: () => request<{ items: OtaSoftwareVersion[] }>('/v1/software-versions'),
  uploadSoftwareVersion: (data: FormData) => request<OtaSoftwareVersion>('/v1/software-versions', { method: 'POST', body: data }),
  configVersions: () => request<{ items: OtaConfigVersion[] }>('/v1/config-versions'),
  createConfigVersion: (data: Record<string, unknown>) => request<OtaConfigVersion>('/v1/config-versions', { method: 'POST', body: JSON.stringify(data) }),
  decideConfigVersion: (id: string, decision: 'APPROVED' | 'REJECTED', reason: string) => request<OtaConfigVersion>(`/v1/config-versions/${id}/approval`, { method: 'POST', body: JSON.stringify({ decision, reason }) }),
  otaCampaigns: () => request<{ items: OtaCampaign[] }>('/v1/ota/campaigns'),
  otaJobs: () => request<{ items: OtaJob[] }>('/v1/ota'),
  createOtaCampaign: (data: Record<string, unknown>) => request<OtaCampaign>('/v1/ota/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  robotPage: (query: FileQuery) => request<RobotPage>(`/v1/robots/page?${queryString(query)}`),
  robot: (id: string) => request<RobotDetail>(`/v1/robots/${id}`),
  createRobot: (data: { name: string; externalId?: string; metadata?: Record<string, unknown> }) => request<Robot>('/v1/robots', { method: 'POST', body: JSON.stringify(data) }),
  files: (query: FileQuery) => request<FilePage>(`/v1/files?${queryString(query)}`),
  allFiles: getAllFiles,
  file: (id: string) => request<RobotFile>(`/v1/files/${id}`),
  download: (id: string) => request<{ url: string }>(`/v1/files/${id}/download`),
  deleteFile: (id: string) => request<void>(`/v1/files/${id}`, { method: 'DELETE' }),
  upload: (data: FormData) => request<RobotFile>('/v1/files', { method: 'POST', body: data }),
  datasets: () => request<Dataset[]>('/v1/datasets'),
  datasetPage: (query: FileQuery) => request<DatasetPage>(`/v1/datasets/page?${queryString(query)}`),
  dataset: (id: string) => request<Dataset>(`/v1/datasets/${id}`),
  createDataset: (data: { name: string; description?: string }) => request<Dataset>('/v1/datasets', { method: 'POST', body: JSON.stringify(data) }),
  createVersion: (id: string, input: string[] | { fileIds?: string[]; sourceVersionId?: string }) => request<DatasetVersion>(`/v1/datasets/${id}/versions`, { method: 'POST', body: JSON.stringify(Array.isArray(input) ? { fileIds: input } : input) }),
  versionPage: (query: FileQuery) => request<VersionPage>(`/v1/datasets/versions/page?${queryString(query)}`),
  version: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}`),
  versionFiles: (id: string, query: FileQuery) => request<FilePage>(`/v1/datasets/versions/${id}/files?${queryString(query)}`),
  versionCandidates: (id: string, query: FileQuery) => request<FilePage>(`/v1/datasets/versions/${id}/candidates?${queryString(query)}`),
  addFiles: (id: string, fileIds: string[]) => request<DatasetVersion>(`/v1/datasets/versions/${id}/files`, { method: 'POST', body: JSON.stringify({ fileIds }) }),
  replaceVersionFiles: (id: string, fileIds: string[]) => request<DatasetVersion>(`/v1/datasets/versions/${id}/files`, { method: 'PUT', body: JSON.stringify({ fileIds }) }),
  removeFile: (versionId: string, fileId: string) => request<void>(`/v1/datasets/versions/${versionId}/files/${fileId}`, { method: 'DELETE' }),
  validateVersion: (id: string) => request<ValidationReport>(`/v1/datasets/versions/${id}/validate`, { method: 'POST' }),
  compareVersions: (datasetId: string, baseVersionId: string, targetVersionId: string) => request<VersionComparison>(`/v1/datasets/${datasetId}/versions/compare?${queryString({ baseVersionId, targetVersionId })}`),
  freeze: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}/freeze`, { method: 'POST' }),
  publish: (id: string) => request<DatasetVersion>(`/v1/datasets/versions/${id}/publish`, { method: 'POST' }),
  publishJob: (id: string) => request<Job>(`/v1/datasets/versions/${id}/publish-jobs`, { method: 'POST' }),
  recoveryJob: (id: string) => request<Job>(`/v1/datasets/versions/${id}/recovery-jobs`, { method: 'POST' }),
  jobs: (query: FileQuery) => request<Page<Job>>(`/v1/jobs/page?${queryString(query)}`),
  job: (id: string) => request<Job>(`/v1/jobs/${id}`),
  retryJob: (id: string) => request<Job>(`/v1/jobs/${id}/retry`, { method: 'POST' }),
  cancelJob: (id: string) => request<Job>(`/v1/jobs/${id}/cancel`, { method: 'POST' }),
  activity: (query: FileQuery) => request<Page<{ id: string; source: string; type: string; status: string; timestamp: string; actor?: { displayName: string }; resourceType?: string; resourceId?: string; jobId?: string }>>(`/v1/activity/page?${queryString(query)}`),
  notifications: (query: FileQuery) => request<Page<{ id: string; type: string; title: string; message: string; resourceUrl?: string; readAt?: string; createdAt: string }> & { unread: number }>(`/v1/notifications?${queryString(query)}`),
  readNotification: (id: string) => request<{ success: boolean }>(`/v1/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request<{ success: boolean }>('/v1/notifications/read-all', { method: 'POST' }),
  tags: () => request<Tag[]>('/v1/tags'),
  createTag: (data: { name: string; color: string }) => request<Tag>('/v1/tags', { method: 'POST', body: JSON.stringify(data) }),
  bulkTagFiles: (fileIds: string[], tagIds: string[]) => request<{ attached: number }>('/v1/tags/files/bulk', { method: 'POST', body: JSON.stringify({ fileIds, tagIds }) }),
  savedViews: (resource: string) => request<Array<{ id: string; name: string; resource: string; query: Record<string, string | number | boolean>; isShared: boolean; owner: { displayName: string } }>>(`/v1/saved-views?resource=${resource}`),
  createSavedView: (data: { resource: string; name: string; query: Record<string, string | number | boolean>; isShared?: boolean }) => request<{ id: string }>('/v1/saved-views', { method: 'POST', body: JSON.stringify(data) }),
  deleteSavedView: (id: string) => request<void>(`/v1/saved-views/${id}`, { method: 'DELETE' }),
  storageObjects: (query: FileQuery) => request<{ items: Array<{ objectKey: string; size: number; etag?: string; lastModified?: string; mapping: unknown }>; nextCursor?: string }>(`/v1/storage/objects?${queryString(query)}`),
  reconciliationRuns: (query: FileQuery) => request<Page<{ id: string; status: string; scannedObjects: number; indexedObjects: number; issueCount: number; createdAt: string }>>(`/v1/storage/reconciliation-runs/page?${queryString(query)}`),
  reconciliationRun: (id: string) => request<{ id: string; status: string; issues: Array<{ id: string; type: string; status: string; objectKey: string; expectedSize?: string; actualSize?: string }> }>(`/v1/storage/reconciliation-runs/${id}`),
  startReconciliation: () => request<{ job: Job }>('/v1/storage/reconciliation-runs', { method: 'POST' }),
  deleteOrphans: (issueIds: string[]) => request<Job>('/v1/storage/orphan-deletion-jobs', { method: 'POST', body: JSON.stringify({ issueIds, confirmation: 'DELETE_ORPHAN_OBJECTS' }) }),
  systemConfiguration: () => request<{ settings: Record<string, number | boolean>; infrastructure: Record<string, unknown>; worker: Record<string, unknown> }>('/v1/system/configuration'),
  updateSettings: (values: Record<string, unknown>) => request<Record<string, unknown>>('/v1/system/settings', { method: 'PATCH', body: JSON.stringify({ values }) }),
  users: (query: FileQuery) => request<Page<AuthUser & { isActive: boolean; lastLoginAt?: string; createdAt: string }>>(`/v1/users/page?${queryString(query)}`),
  createUser: (data: { email: string; displayName: string; role: UserRole; temporaryPassword: string }) => request<AuthUser>('/v1/users', { method: 'POST', body: JSON.stringify(data) }),
  auditLogs: (query: FileQuery) => request<Page<{ id: string; action: string; route?: string; statusCode?: number; actor?: { email: string; displayName: string }; createdAt: string }>>(`/v1/audit-logs/page?${queryString(query)}`),
  createUpload: (data: { robotId: string; originalName: string; mimeType: string; fileSize: number; checksum: string; recognitionType: string; schemaVersion: string; capturedAt: string; metadata?: Record<string, unknown>; lastModified?: number }) => request<ResumableUpload>('/v1/uploads', { method: 'POST', body: JSON.stringify(data) }),
  uploadSession: (id: string) => request<ResumableUpload>(`/v1/uploads/${id}`),
  uploadPart: (id: string, partNumber: number, bytes: ArrayBuffer, start: number, end: number, total: number, checksum: string, signal?: AbortSignal) => request<{ partNumber: number }>(`/v1/uploads/${id}/parts/${partNumber}`, { method: 'PUT', body: bytes, signal, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${total}`, 'X-Part-SHA256': checksum } }),
  completeUpload: (id: string) => request<Job | { completed: true; robotFileId: string }>(`/v1/uploads/${id}/complete`, { method: 'POST' }),
  abortUpload: (id: string) => request<void>(`/v1/uploads/${id}`, { method: 'DELETE' }),
  preview: async (file: RobotFile) => {
    const { url } = await request<{ url: string }>(`/v1/files/${file.id}/download`);
    if (file.mimeType.startsWith('image/')) return { kind: 'image' as const, url };
    if (Number(file.fileSize) > 1024 * 1024) return { kind: 'large' as const, url };
    const response = await fetch(url); if (!response.ok) throw new Error(`Preview failed (${response.status})`);
    if (file.mimeType.includes('json')) return { kind: 'json' as const, value: await response.json(), url };
    if (file.mimeType.startsWith('text/')) return { kind: 'text' as const, value: await response.text(), url };
    return { kind: 'unsupported' as const, url };
  },
};
