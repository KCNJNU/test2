# Device Gateway — D2

## Runtime

The Device Gateway is a separate NestJS application context compiled from the API workspace. It shares Prisma models and configuration but does not expose HTTP endpoints.

```powershell
npm run gateway:dev --workspace @cleaning-robot/api
```

Set `DEVICE_GATEWAY_ENABLED=true` and all D2 timeout variables in the repository-root `.env`. Production deployments run `npm run gateway --workspace @cleaning-robot/api` as an independent process after the workspace build.

## Processing flow

```text
EMQX QoS 1 message
  -> Topic + schemaVersion validation
  -> Topic robotId + envelope robotId + registered robotSn verification
  -> PostgreSQL transaction
       -> Inbox deduplication
       -> sequence freshness decision
       -> Heartbeat / Telemetry / Event / Fault / ACK persistence
       -> current-state reconciliation only when fresh
```

Unknown schema versions, invalid Topics, unregistered devices and ownership mismatches are rejected with a fixed error code. Raw payloads, credentials and low-level connection errors are not logged.

## Command delivery

The gateway polls unpublished PostgreSQL Outbox rows with `FOR UPDATE SKIP LOCKED`, applies the command safety guard, publishes QoS 1, then marks the Command `SENT`. A Robot ACK may advance it through `ACCEPTED`, `EXECUTING` and a terminal status. Invalid or regressive ACK transitions are retained in Inbox but do not regress Command state. Missing ACKs become `TIMEOUT` after `COMMAND_ACK_TIMEOUT_MS`.

The gateway only publishes `MISSION_START`, `MISSION_PAUSE`, `MISSION_RESUME`, `MISSION_CANCEL`, `RETURN_TO_CHARGE`, `RETURN_TO_STANDBY`, `CONFIG_APPLY`, and `SOFTWARE_UPDATE`. Robot Agent remains responsible for local state and safety rejection.

## Offline behavior

- `ROBOT_UNSTABLE_TIMEOUT_MS` changes cloud online status to `UNSTABLE`.
- `ROBOT_OFFLINE_TIMEOUT_MS` changes online and operational status to `OFFLINE`.
- A newer heartbeat reconciles the current robot state after reconnect.
- SAFE, task and fault events are reliable messages; ordinary high-frequency telemetry may be lossy at the Robot Agent.
- Cloud/API/MQTT failure has no authority over local `safety_stop` or latched SAFE clearance.

## Development simulator

Set `MOCK_ROBOT_ID`, matching `MOCK_ROBOT_SN`, and `MOCK_ROBOT_SCENARIO`, then run:

```powershell
npm run mock-robot:dev --workspace @cleaning-robot/api
```

Supported scenarios are `ONLINE`, `OFFLINE`, `READY`, `RUNNING`, `PAUSED`, `BLOCKED`, `SAFE-101`, `SAFE-106`, `SAFE-202`, `SAFE-301`, `ACK_ACCEPT`, `ACK_REJECT`, `TIMEOUT`, `MAP_VERSION_MISMATCH`, `RECONNECT`, `OUT_OF_ORDER`, and `DUPLICATE_EVENT`. Simulator payloads carry `simulation: true`; they are development evidence, not field-robot acceptance.

## Production gates

MQTT TLS, client certificates, certificate rotation, per-robot ACLs, production connection logs, mass reconnect capacity and real Robot Agent interoperability are not claimed by D2 and remain D6/external acceptance gates.
# D6 transport identity

Production Gateway connects as `device-gateway` using a Vault-rendered CA, client certificate and private key. It refuses plaintext MQTT, password authentication, a different client ID, missing TLS files or disabled server verification. Robot CN/client IDs must be canonical UUIDs and may publish/subscribe only the matching topic namespace. EMQX CRL revocation is part of the certificate-revoke acceptance test.

Run `node scripts/d6/mqtt-security-acceptance.mjs <manifest>` with two Robot certificates and the Gateway certificate to prove no-certificate rejection and A/B topic isolation. A separate manifest containing 100 unique UUID certificates drives `mass-reconnect.mjs`; the pass threshold is 99% and each identity must have its own certificate to avoid MQTT session takeover.
