import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { connectAsync } from 'mqtt';

const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const identity = manifest.identities[Number(process.env.IDENTITY_INDEX ?? 1)];
const expectedRevoked = process.env.EXPECT_REVOKED === 'true';
let connected = false;
let client;
try {
  client = await connectAsync(manifest.broker, {
    clientId: identity.id,
    ca: await readFile(manifest.caFile),
    cert: await readFile(identity.certFile),
    key: await readFile(identity.keyFile),
    servername: manifest.serverName,
    rejectUnauthorized: true,
    reconnectPeriod: 0,
    connectTimeout: 5_000,
  });
  connected = true;
} catch {
  connected = false;
} finally {
  if (client) await client.endAsync(true).catch(() => undefined);
}
assert.equal(connected, !expectedRevoked, expectedRevoked ? 'revoked certificate was accepted' : 'active certificate was rejected');
process.stdout.write(expectedRevoked ? 'Revoked certificate rejected\n' : 'Active certificate accepted\n');
