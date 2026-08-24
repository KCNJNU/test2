# D3 Observability

## Runtime contract

D3 adds a vendor-neutral observability surface without changing the four safety/state-machine contracts.

- API metrics: `http://localhost:3000/metrics`
- Device Gateway metrics: `http://127.0.0.1:9464/metrics`
- Authenticated, tenant-scoped UI summary: `GET /api/v1/observability/summary`
- Prometheus DEV profile: `docker compose --profile observability up -d prometheus`
- Prometheus UI: `http://localhost:9090`

The API, worker and gateway emit one-line JSON logs to stdout/stderr. Common fields are `timestamp`, `level`, `service`, `instance`, `traceId`, `requestId`, `userId`, `robotId`, `taskId` and `commandId`. HTTP accepts W3C `traceparent`, `X-Trace-ID` and `X-Request-ID`; responses return `X-Trace-ID` and `X-Request-ID`. MQTT envelopes accept an optional 32-hex-character `traceId`, and command envelopes always carry a stable trace ID.

Secrets, authorization values and credential-bearing URI components are redacted. Protocol rejection logs expose only bounded error codes, never payloads or underlying connection errors.

## Metric catalog

| Metric | Meaning | Cardinality boundary |
| --- | --- | --- |
| `platform_http_requests_total` | Requests by method, normalized route and status | No URL IDs or query values |
| `platform_http_request_duration_seconds` | API latency histogram | Same bounded labels |
| `platform_device_gateway_connected` | MQTT connectivity of the gateway | No labels beyond service |
| `platform_gateway_inbound_messages_total` | Inbound channel result | Fixed channel/result vocabulary |
| `platform_gateway_commands_total` | Bounded outbox work and ACK timeouts | Fixed result vocabulary |
| `platform_robot_online_transitions_total` | Offline detector transitions | `offline` or `unstable` |
| `platform_robots` | Fleet state counts | Enum state labels only |
| `platform_tasks`, `platform_commands` | Lifecycle counts | Enum status only |
| `platform_open_faults` | Active faults by severity | Enum severity only |
| `platform_job_backlog`, `platform_outbox_backlog` | Durable queue backlog | Bounded job status |
| `platform_metrics_refresh_success` | Latest database-backed gauge refresh result | No variable labels |

The `/metrics` endpoints are public for DEV scraping and must be network-restricted at the ingress or service-mesh layer outside DEV. They contain aggregate/process data, not tenant records or secrets. The Web summary remains authenticated and applies tenant scope; ADMIN and SUPER_ADMIN retain platform scope.

## Triage

### Target down

1. Check `/health`; distinguish `unhealthy` from `not_checked`.
2. Check process/container state, then PostgreSQL, Redis, EMQX and MinIO.
3. Correlate JSON logs using `traceId`; use `robotId`, `taskId` or `commandId` only after access scope is confirmed.
4. Do not treat loss of cloud connectivity as proof that a robot stopped. Robot MCU/agent safety remains authoritative.

### MQTT or command incident

Inspect `platform_device_gateway_connected`, inbound rejection results, outbox backlog and ACK timeouts. Do not automatically replay non-idempotent or safety-sensitive commands. Confirm robot identity, tenant ownership, active user permission and SAFE state before operator action.

## Production boundary

The DEV Prometheus profile proves scraping and rule evaluation. Long-term log storage, distributed trace backend, Alertmanager notification routing, retention, HA and on-call integration require environment-owned infrastructure in D6. TEST/STAGING/PRODUCTION must use independent stores and credentials.
# D6 security and recovery signals

Monitor certificate expiry (30-day warning), MQTT authentication/authorization denials, mass reconnect rate, Vault renewal/template failure, database/object backup age, Restic check result, restore-drill age and retention Job result. EMQX emits JSON connection/auth logs; retention is 90 days. Labels must use bounded service/policy values, never email, raw IP, token, certificate PEM or MQTT payload.
