import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { connectAsync } from 'mqtt';

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('usage: node scripts/d6/mqtt-security-acceptance.mjs CERTIFICATE_MANIFEST.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const broker = manifest.broker;
assert.match(broker, /^mqtts:\/\//);
const bytes = (path) => readFile(path);
const tls = async (identity) => ({ ca: await bytes(manifest.caFile), cert: await bytes(identity.certFile), key: await bytes(identity.keyFile), servername: manifest.serverName, rejectUnauthorized: true });
const client = async (identity) => connectAsync(broker, { clientId: identity.id, clean: true, reconnectPeriod: 0, connectTimeout: 5_000, ...(await tls(identity)) });

const [robotA, robotB, gateway] = manifest.identities;
for (const identity of [robotA, robotB]) assert.match(identity.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.equal(gateway.id, 'device-gateway');

let anonymousRejected = false;
try { const anonymous = await connectAsync(broker, { clientId: 'no-certificate', reconnectPeriod: 0, connectTimeout: 3_000, ca: await bytes(manifest.caFile), servername: manifest.serverName, rejectUnauthorized: true }); await anonymous.endAsync(true); }
catch { anonymousRejected = true; }
assert.equal(anonymousRejected, true, 'broker accepted a client without a certificate');

const a = await client(robotA); const g = await client(gateway);
try {
  const ownTopic = `robots/${robotA.id}/commands`; const foreignTopic = `robots/${robotB.id}/commands`;
  const ownGrant = await a.subscribeAsync(ownTopic, { qos: 1 });
  assert.notEqual(ownGrant[0]?.qos, 128, 'Robot A could not subscribe to its own command topic');
  let foreignDenied = false;
  try { const grant = await a.subscribeAsync(foreignTopic, { qos: 1 }); foreignDenied = grant[0]?.qos === 128; } catch { foreignDenied = true; }
  assert.equal(foreignDenied, true, 'Robot A subscribed to Robot B command topic');
  const received = new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(new Error('own command not received')),3_000);a.once('message',(topic)=>{clearTimeout(timer);resolve(topic);}); });
  await g.publishAsync(ownTopic, JSON.stringify({ type: 'acceptance' }), { qos: 1 });
  assert.equal(await received, ownTopic);
  await g.subscribeAsync('robots/+/telemetry', { qos: 1 });
  const telemetry = [];
  g.on('message', (topic) => telemetry.push(topic));
  await a.publishAsync(`robots/${robotA.id}/telemetry`, JSON.stringify({ allowed: true }), { qos: 1 });
  await a.publishAsync(`robots/${robotB.id}/telemetry`, JSON.stringify({ allowed: false }), { qos: 1 });
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(telemetry.includes(`robots/${robotA.id}/telemetry`), 'Robot A own telemetry was not delivered');
  assert.ok(!telemetry.includes(`robots/${robotB.id}/telemetry`), 'Robot A published into Robot B topic namespace');
  process.stdout.write('MQTT mTLS and tenant-topic ACL acceptance passed\n');
} finally { await Promise.all([a.endAsync(true), g.endAsync(true)]); }
