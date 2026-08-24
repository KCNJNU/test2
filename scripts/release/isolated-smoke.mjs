import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { connectAsync } from 'mqtt';

const baseUrl = required('SMOKE_JAVA_BASE_URL').replace(/\/$/, '');
const adminEmail = required('SMOKE_ADMIN_EMAIL');
const bootstrapPassword = required('SMOKE_ADMIN_BOOTSTRAP_PASSWORD');
const adminPassword = required('SMOKE_ADMIN_PASSWORD');
const tenantPassword = required('SMOKE_TENANT_PASSWORD');
const mqttUrl = required('SMOKE_MQTT_URL');
const prisma = new PrismaClient();
const results = [];

class SessionClient {
  cookie;
  csrfToken;

  async login(email, password, expected = [200]) {
    const response = await this.request('/api/v1/auth/login', { method: 'POST', body: { email, password }, expected, authenticated: false, csrf: false });
    if (response.status === 200) {
      const setCookie = response.headers.getSetCookie()[0];
      assert.ok(setCookie, 'Login must set the session cookie');
      this.cookie = setCookie.split(';', 1)[0];
      this.csrfToken = response.data.csrfToken;
    }
    return response;
  }

  async request(path, options = {}) {
    const method = options.method ?? 'GET';
    const headers = new Headers(options.headers);
    if (options.authenticated !== false && this.cookie) headers.set('Cookie', this.cookie);
    if (options.csrf !== false && !['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) headers.set('X-CSRF-Token', this.csrfToken);
    let body = options.body;
    if (body !== undefined && !Buffer.isBuffer(body) && typeof body !== 'string') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
    const text = await response.text();
    let data = text;
    if (text && response.headers.get('content-type')?.includes('json')) data = JSON.parse(text);
    const expected = options.expected ?? [200, 201, 202, 204];
    assert.ok(expected.includes(response.status), `${method} ${path}: expected ${expected.join('/')} but received ${response.status}: ${text.slice(0, 500)}`);
    return { status: response.status, headers: response.headers, data };
  }
}

async function main() {
  const anonymous = await fetch(`${baseUrl}/api/v1/robots`);
  assert.equal(anonymous.status, 401);
  pass('AUTH-401', 'Unauthenticated business API rejected');

  const admin = new SessionClient();
  const currentLogin = await admin.login(adminEmail, adminPassword, [200, 401]);
  if (currentLogin.status === 401) {
    await admin.login(adminEmail, bootstrapPassword);
    await admin.request('/api/v1/auth/change-password', { method: 'POST', body: { currentPassword: bootstrapPassword, newPassword: adminPassword } });
    await admin.login(adminEmail, adminPassword);
  }
  pass('AUTH-LOGIN', 'Cookie session login and mandatory password rotation succeeded');

  const csrfRejected = await admin.request('/api/v1/tenants', { method: 'POST', body: { code: `CSRF-${Date.now()}`, name: 'Must not exist' }, csrf: false, expected: [403] });
  assert.equal(csrfRejected.data.code, 'CSRF_INVALID');
  pass('AUTH-CSRF', 'Mutating cookie request without CSRF token rejected');

  const runId = Date.now().toString(36);
  const tenantA = (await admin.request('/api/v1/tenants', { method: 'POST', body: { code: `REPAIR-A-${runId}`, name: `Repair Tenant A ${runId}` } })).data;
  const tenantB = (await admin.request('/api/v1/tenants', { method: 'POST', body: { code: `REPAIR-B-${runId}`, name: `Repair Tenant B ${runId}` } })).data;
  const projectA = (await admin.request('/api/v1/projects', { method: 'POST', body: { tenantId: tenantA.id, code: `PROJECT-A-${runId}`, name: `Repair Project A ${runId}` } })).data;
  const projectB = (await admin.request('/api/v1/projects', { method: 'POST', body: { tenantId: tenantB.id, code: `PROJECT-B-${runId}`, name: `Repair Project B ${runId}` } })).data;
  const siteA = (await admin.request('/api/v1/sites', { method: 'POST', body: { projectId: projectA.id, code: `SITE-A-${runId}`, name: 'Repair Site A' } })).data;
  const siteB = (await admin.request('/api/v1/sites', { method: 'POST', body: { projectId: projectB.id, code: `SITE-B-${runId}`, name: 'Repair Site B' } })).data;
  const floorA = (await admin.request('/api/v1/floors', { method: 'POST', body: { projectId: projectA.id, siteId: siteA.id, code: `FLOOR-A-${runId}`, name: 'Repair Floor A', level: 1 } })).data;
  const floorB = (await admin.request('/api/v1/floors', { method: 'POST', body: { projectId: projectB.id, siteId: siteB.id, code: `FLOOR-B-${runId}`, name: 'Repair Floor B', level: 1 } })).data;
  const userAEmail = `repair-a-${runId}@robot.local`;
  const userBEmail = `repair-b-${runId}@robot.local`;
  await admin.request('/api/v1/users', { method: 'POST', body: { email: userAEmail, displayName: 'Repair Tenant A', role: 'TENANT_ADMIN', tenantId: tenantA.id, temporaryPassword: tenantPassword } });
  await admin.request('/api/v1/users', { method: 'POST', body: { email: userBEmail, displayName: 'Repair Tenant B', role: 'TENANT_ADMIN', tenantId: tenantB.id, temporaryPassword: tenantPassword } });

  const robotA = await prisma.robot.update({
    where: { externalId: 'CR-001' },
    data: { tenantId: tenantA.id, projectId: projectA.id, siteId: siteA.id, floorId: floorA.id, onlineStatus: 'ONLINE', operationalState: 'READY', currentTaskId: null },
  });
  await prisma.safetyState.updateMany({
    where: { robotId: robotA.id, source: 'REPAIR_SMOKE', active: true },
    data: { active: false, clearedAt: new Date() },
  });
  await prisma.faultEvent.updateMany({
    where: { robotId: robotA.id, source: 'REPAIR_SMOKE', endAt: null },
    data: { endAt: new Date() },
  });
  const robotB = await prisma.robot.create({ data: { name: `Repair Robot B ${runId}`, externalId: `REPAIR-B-${runId}`, tenantId: tenantB.id, projectId: projectB.id, siteId: siteB.id, floorId: floorB.id } });
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const mapA = await createPublishedMap({ tenantId: tenantA.id, projectId: projectA.id, floorId: floorA.id, createdById: adminUser.id, suffix: `a-${runId}` });
  const mapB = await createPublishedMap({ tenantId: tenantB.id, projectId: projectB.id, floorId: floorB.id, createdById: adminUser.id, suffix: `b-${runId}` });

  const tenantAClient = new SessionClient();
  await tenantAClient.login(userAEmail, tenantPassword);
  const ownRobot = await tenantAClient.request(`/api/v1/robots/${robotA.id}`);
  assert.equal(ownRobot.data.id, robotA.id);
  await tenantAClient.request(`/api/v1/robots/${robotB.id}`, { expected: [403, 404] });
  await tenantAClient.request(`/api/v1/robots?projectId=${projectB.id}`, { expected: [403, 404] });
  const tenantAList = await tenantAClient.request('/api/v1/robots');
  assert.ok(tenantAList.data.items.every((robot) => robot.tenantId === tenantA.id));
  pass('TENANT-IDOR', 'Tenant A cannot read Tenant B robot or project scope');

  const content = Buffer.from(JSON.stringify({ frame: 1, source: 'repair-smoke', runId }));
  const checksum = sha256(content);
  const upload = (await admin.request('/api/v1/uploads', { method: 'POST', body: {
    robotId: robotA.id, originalName: `repair-${runId}.json`, mimeType: 'application/json', fileSize: content.length,
    checksum, recognitionType: 'repair-smoke', schemaVersion: '1.0', capturedAt: new Date().toISOString(), metadata: { isolated: true },
  } })).data;
  const partPath = `/api/v1/uploads/${upload.id}/parts/1`;
  await admin.request(partPath, { method: 'PUT', body: content, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes 1-${content.length}/${content.length}`, 'X-Part-SHA256': checksum }, expected: [400] });
  await admin.request(partPath, { method: 'PUT', body: content, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes 0-${content.length - 1}/${content.length}`, 'X-Part-SHA256': '0'.repeat(64) }, expected: [409] });
  await admin.request(partPath, { method: 'PUT', body: content, headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes 0-${content.length - 1}/${content.length}`, 'X-Part-SHA256': checksum } });
  await admin.request(`/api/v1/uploads/${upload.id}/complete`, { method: 'POST' });
  const completedUpload = await poll(async () => (await admin.request(`/api/v1/uploads/${upload.id}`)).data, (value) => value.status === 'COMPLETED', 'upload finalize');
  assert.ok(completedUpload.robotFileId);
  const file = (await admin.request(`/api/v1/files/${completedUpload.robotFileId}`)).data;
  assert.equal(file.fileSize, String(content.length));
  pass('UPLOAD-FINALIZE', 'Range/SHA rejection, MinIO composition, worker finalize, and BigInt string serialization succeeded');

  const dataset = (await admin.request('/api/v1/datasets', { method: 'POST', body: { name: `repair-dataset-${runId}`, description: 'Isolated DVC smoke dataset' } })).data;
  const version = (await admin.request(`/api/v1/datasets/${dataset.id}/versions`, { method: 'POST', body: { fileIds: [file.id] } })).data;
  const frozen = (await admin.request(`/api/v1/datasets/versions/${version.id}/freeze`, { method: 'POST' })).data;
  assert.equal(frozen.status, 'FROZEN');
  const validation = (await admin.request(`/api/v1/datasets/versions/${version.id}/validate`, { method: 'POST' })).data;
  assert.equal(validation.valid, true);
  await admin.request(`/api/v1/files/${file.id}`, { method: 'DELETE', expected: [409] });
  const published = (await admin.request(`/api/v1/datasets/versions/${version.id}/publish`, { method: 'POST' })).data;
  assert.equal(published.status, 'PUBLISHED');
  assert.match(published.gitTag, /^dataset-/);
  const recoveryJob = (await admin.request(`/api/v1/datasets/versions/${version.id}/recovery-jobs`, { method: 'POST' })).data;
  const recovered = await poll(async () => (await admin.request(`/api/v1/jobs/${recoveryJob.id}`)).data, (value) => ['SUCCEEDED', 'FAILED'].includes(value.status), 'recovery job', 120_000);
  assert.equal(recovered.status, 'SUCCEEDED', JSON.stringify(recovered));
  pass('DATASET-DVC', 'Draft, membership, freeze, manifest validation, DVC push/tag, recovery, and P2003 protection succeeded');

  const task = (await admin.request('/api/v1/tasks', { method: 'POST', body: { projectId: projectA.id, robotId: robotA.id, mapVersionId: mapA.id, name: `Repair Task ${runId}` } })).data;
  const idempotencyKey = randomUUID();
  const command = (await admin.request(`/api/v1/tasks/${task.id}/start`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } })).data;
  const repeated = (await admin.request(`/api/v1/tasks/${task.id}/start`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } })).data;
  assert.equal(command.id, repeated.id);
  const acceptedCommand = await poll(() => prisma.command.findUniqueOrThrow({ where: { id: command.id } }), (value) => ['ACCEPTED', 'EXECUTING', 'SUCCEEDED'].includes(value.status), 'MQTT command ACK');
  assert.ok(acceptedCommand.acceptedAt);
  await poll(() => prisma.task.findUniqueOrThrow({ where: { id: task.id } }), (value) => value.status === 'RUNNING', 'task RUNNING');
  await admin.request(`/api/v1/tasks/${task.id}/pause`, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() } });
  await poll(() => prisma.task.findUniqueOrThrow({ where: { id: task.id } }), (value) => value.status === 'PAUSED', 'task PAUSED');
  await prisma.safetyState.create({ data: { robotId: robotA.id, code: 'SAFE-106', active: true, latched: true, fullBlock: true, source: 'REPAIR_SMOKE', message: 'Isolated full-block test', occurredAt: new Date() } });
  const fault = await prisma.faultEvent.create({ data: { tenantId: tenantA.id, projectId: projectA.id, robotId: robotA.id, taskId: task.id, safeCode: 'SAFE-106', source: 'REPAIR_SMOKE', severity: 'LATCHED', latched: true, fullBlock: true, startAt: new Date() } });
  await admin.request(`/api/v1/faults/${fault.id}/acknowledge`, { method: 'POST', body: { note: 'Acknowledged during isolated smoke test' } });
  assert.equal((await prisma.safetyState.findFirstOrThrow({ where: { robotId: robotA.id, code: 'SAFE-106', active: true } })).active, true);
  await admin.request(`/api/v1/tasks/${task.id}/resume`, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, expected: [409] });
  const offlineTask = (await admin.request('/api/v1/tasks', { method: 'POST', body: { projectId: projectB.id, robotId: robotB.id, mapVersionId: mapB.id, name: `Offline Task ${runId}` } })).data;
  await admin.request(`/api/v1/tasks/${offlineTask.id}/start`, { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, expected: [409] });
  pass('TASK-SAFETY', 'Idempotency, MQTT ACK/state transitions, offline READY guard, and latched SAFE isolation succeeded');

  const sequenceBefore = (await prisma.robot.findUniqueOrThrow({ where: { id: robotA.id } })).lastStateSequence ?? 0n;
  const freshSequence = sequenceBefore + 1_000n;
  const freshMessageId = `REPAIR-FRESH-${randomUUID()}`;
  const duplicateMessageId = `REPAIR-DUPLICATE-${randomUUID()}`;
  const publisherId = `repair-reconnect-${randomUUID()}`;
  let mqtt = await connectAsync(mqttUrl, { clientId: publisherId, clean: false, reconnectPeriod: 0, connectTimeout: 5_000 });
  await publishHeartbeat(mqtt, robotA, freshMessageId, freshSequence, 'BLOCKED');
  await poll(() => prisma.robot.findUniqueOrThrow({ where: { id: robotA.id } }), (value) => value.lastStateSequence === freshSequence, 'fresh MQTT sequence');
  await publishHeartbeat(mqtt, robotA, `REPAIR-STALE-${randomUUID()}`, freshSequence - 1n, 'READY');
  const duplicate = deviceEnvelope(robotA, duplicateMessageId, freshSequence + 1n, 'BLOCKED');
  await mqtt.publishAsync(`robots/${robotA.id}/heartbeat`, JSON.stringify(duplicate), { qos: 1 });
  await mqtt.publishAsync(`robots/${robotA.id}/heartbeat`, JSON.stringify(duplicate), { qos: 1 });
  await poll(() => prisma.inboxMessage.count({ where: { robotId: robotA.id, messageId: duplicateMessageId } }), (count) => count === 1, 'MQTT duplicate inbox deduplication');
  const afterStale = await prisma.robot.findUniqueOrThrow({ where: { id: robotA.id } });
  assert.equal(afterStale.lastStateSequence, freshSequence + 1n);
  assert.equal(afterStale.operationalState, 'BLOCKED');
  await mqtt.endAsync(false);
  mqtt = await connectAsync(mqttUrl, { clientId: publisherId, clean: false, reconnectPeriod: 0, connectTimeout: 5_000 });
  await publishHeartbeat(mqtt, robotA, `REPAIR-RECONNECT-${randomUUID()}`, freshSequence + 2n, 'BLOCKED');
  await poll(() => prisma.robot.findUniqueOrThrow({ where: { id: robotA.id } }), (value) => value.lastStateSequence === freshSequence + 2n, 'MQTT reconnect message');
  await mqtt.endAsync(false);
  pass('MQTT-ORDERING', 'Fresh, stale, duplicate messageId, and persistent-client reconnect behavior succeeded');

  console.log(JSON.stringify({ status: 'PASS', results, artifacts: { robotId: robotA.id, fileId: file.id, datasetVersionId: version.id, taskId: task.id, sequenceBefore: sequenceBefore.toString() } }, null, 2));
}

function deviceEnvelope(robot, messageId, sequence, state) {
  return {
    schemaVersion: '1.0', messageId, robotId: robot.id, robotSn: robot.externalId,
    timestamp: Date.now(), sequence: sequence.toString(), type: 'heartbeat',
    payload: { state, robotSn: robot.externalId, simulation: true },
  };
}

function publishHeartbeat(client, robot, messageId, sequence, state) {
  return client.publishAsync(`robots/${robot.id}/heartbeat`, JSON.stringify(deviceEnvelope(robot, messageId, sequence, state)), { qos: 1 });
}

async function createPublishedMap({ tenantId, projectId, floorId, createdById, suffix }) {
  const map = await prisma.platformMap.create({ data: { tenantId, projectId, floorId, name: `Repair Map ${suffix}` } });
  return prisma.mapVersion.create({ data: { mapId: map.id, version: 1, floorId, mapObjectKey: `repair/maps/${suffix}.pgm`, mimeType: 'image/x-portable-graymap', checksum: sha256(Buffer.from(suffix)), status: 'PUBLISHED', createdById, publishedAt: new Date() } });
}

async function poll(load, done, label, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await load();
    if (done(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last, (_, value) => typeof value === 'bigint' ? value.toString() : value)}`);
}

function pass(id, detail) { results.push({ id, status: 'PASS', detail }); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function required(name) { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; }

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
