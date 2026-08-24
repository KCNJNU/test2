# Project Status — Phase 2 Complete

## DevOps D1-D5 increment (2026-08-23)

- D1 provides the PostgreSQL/Redis/EMQX/MinIO DEV foundation, protocol-aware NestJS health checks and four-state Web infrastructure status.
- D2 provides an independent NestJS Device Gateway process with MQTT v1 compatibility routing, registered Robot ID/SN verification, transactional Inbox deduplication, global sequence ordering, Heartbeat/Telemetry/Event/Fault/ACK processing, QoS 1 Outbox command delivery, ACK timeout and heartbeat lease detection.
- A Development-only Mock Robot Agent covers online/state/SAFE/ACK/timeout/reconnect/out-of-order/duplicate scenarios. Production TLS, device certificates, ACL and real Robot Agent acceptance remain external gates.
- D3 adds correlated JSON logs, W3C-compatible trace/request identifiers, Prometheus API/Gateway/process/business metrics, a tenant-scoped System Status signal panel, a DEV Prometheus profile, initial SLOs and safety-aware alert rules.
- D4 adds public version contracts, five immutable application release images, GHCR SBOM/provenance/keyless-signing workflows, CI/security/migration gates, configurable TEST deployment, approved Production promotion and approved host-level blue-green rollback.
- D5 adds immutable software/configuration versions, repeated SHA-256 verification, optional Ed25519 trust, L4 independent approval, OTA eligibility checks, explicit single/batch/percentage/project gray releases, strict Robot Agent state ingestion, simulated checksum/boot rollback scenarios and a dedicated Web release console.

### D5 acceptance status

- Checksum mismatch cannot transition from `VERIFYING` to `INSTALLING`; invalid OTA transitions and cross-robot job events are rejected transactionally.
- `SINGLE` requires exactly one explicit robot; project rollout requires explicit confirmation and a prior successful single/batch canary for the same target.
- L4 Safety configuration is immutable, checksummed, reasoned and cannot be self-approved. Campaign, job, event, actor and rollback fields preserve traceability.
- DEV simulation covers success, pre-install checksum failure and boot-health failure with automatic rollback reporting. Real Robot Agent atomic installation, production signing custody and hardware recovery remain external gates.
- Root `build`, `lint` and `test` pass. The suite now contains 135 tests: NestJS 74, Web 21, Mobile 3, Site 10, Java 16 and release/container policy 11. Prisma validation and all four additive migrations also pass.

### D4 acceptance status

- NestJS and Java expose secret-safe `GET /version`; Web exposes `/version.json` and `/healthz` while separating Java `/api/` and Nest `/nest/` proxy routes.
- Release manifests and image variables reject mutable tags; host deployment records append-only JSONL evidence and keeps the prior stable slot.
- Worker and Device Gateway remain single-active and are verified after deployment and rollback.
- Root `build`, `lint` and `test` pass. The current suite contains 118 tests: NestJS 68, Web 17, Mobile 3, Site 10, Java 9 and release/container policy 11. Prisma validation, all 3 migration policy checks, the current four-entry High vulnerability baseline, YAML parsing and host shell syntax also pass.
- Docker and configured deployment hosts are unavailable in this implementation environment. Real image build, container read-only/non-root runtime, TEST blue-green, Production approval and rollback drills remain explicit external gates; D4 is implemented but not production-accepted.

### D3 verification

- Root `build`, `lint` and `test` pass; the current suite contains 101 tests across NestJS, Web, Mobile, Site and Java.
- Prisma schema validation passes without a D3 migration.
- Runtime smoke verified full healthy dependency status, W3C trace/request response headers, API business metrics and Device Gateway MQTT connectivity metric (`1`) against the local services.
- Compose, Prometheus and AsyncAPI YAML parse successfully. Docker CLI is unavailable in the current shell, so container-profile startup and `promtool` rule evaluation remain environment-gated.
- `.env` remains ignored and the source scan found no private-key or common live-token signatures.

## Completed

- Initialized the Git repository and npm workspaces.
- Added NestJS API, React/Vite/Ant Design web shell, PostgreSQL and MinIO Docker Compose services, root environment template, and project documentation.
- Added REST health endpoint (`GET /health`) and Swagger UI (`/api/docs`).
- Added a workspace-independent root `.env` loading path for the API and verified startup from the API workspace.
- Completed P1 PostgreSQL data models and applied migration `20260812034734_p1_postgresql_data_models` locally. The seed is idempotent and creates `CR-001`, `CR-002`, and `CR-003`.
- Completed P2 RobotFile library: JSON multipart upload, indexed metadata persistence, paginated filtering, file lookup, presigned download URLs, and deletion.
- Completed P3 Dataset / DatasetVersion management: datasets, numbered DRAFT versions, version-file selection, immutable freezing, and object-storage manifests.
- Completed V2.0-B Dataset Workspace productization: server-paged Dataset/Version inventory, version cloning and atomic DRAFT membership replacement, full ObjectStorage integrity validation, Freeze validation gating, same-Dataset compare, and referenced-file deletion protection. No Prisma migration was required.

## Current architecture

- PostgreSQL with Prisma stores Robot, RobotFile, Dataset, DatasetVersion, and DatasetVersionFile metadata and indexes only; raw data is stored by an `ObjectStorage` abstraction.
- `ObjectStorage` defines put/get/delete/existence and presigned-download operations. MinIO is the development adapter; OSS is a contract-only placeholder until production provider requirements and credentials are supplied.
- RobotFile ingestion is JSON-only in this phase. The API validates a 10 MiB maximum size, JSON MIME type/extension and parseability, calculates SHA-256, and stores raw data at server-generated `raw/{robotCode}/{yyyy}/{MM}/{dd}/{uuid}.json` keys. A failed database write triggers object-deletion compensation.
- Dataset versioning models exist, but DVC/Git snapshots are intentionally not implemented until dataset publication.
- A frozen DatasetVersion stores a SHA-256-checked JSON manifest in object storage. Its file membership cannot change; a new DRAFT version is required for changes.

## Models, API, and modules added

- Prisma models: `Robot`, `RobotFile`, `Dataset`, `DatasetVersion`, and `DatasetVersionFile`; `DatasetVersionStatus` enum. RobotFile uses UUID identifiers, a unique SHA-256 checksum, and indexes for robot/capture time, recognition type/capture time, creation time, and file type. DatasetVersion contains manifest, aggregate-size/count, Git, and DVC reference fields.
- `HealthModule` exposes `GET /health` and has a unit test.
- `PrismaModule` supplies the Prisma lifecycle service. `StorageModule` exports the `ObjectStorage` injection token and supplies `MinioObjectStorageService` as the development adapter.
- `FilesModule` exposes documented Swagger endpoints: `POST /api/v1/files`, `GET /api/v1/files`, `GET /api/v1/files/:id`, `GET /api/v1/files/:id/download`, and `DELETE /api/v1/files/:id`. List filtering supports `robotId`, `fileType`, `recognitionType`, `startTime`, `endTime`, `page`, and `pageSize` (maximum 100), and omits metadata from list items.
- API configuration loads the repository-root `.env`; required MinIO fields are `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_PORT`, `OBJECT_STORAGE_USE_SSL`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY`, and `OBJECT_STORAGE_SECRET_KEY`.

## Known limitations

- No background processing, authentication/authorization, retention policy, or DVC publication workflow exists yet.
- JSON is the only accepted RobotFile format; JPG, PNG, PCD, maps, and logs remain future work.
- Duplicate-checking has an application-level preflight plus the database unique constraint; concurrent uploads may surface the database uniqueness error after object storage, which is compensated by deletion.
- Download returns a 15-minute MinIO presigned URL. No audit logging, authorization, or configurable URL lifetime exists.
- The web production bundle currently triggers Vite's advisory chunk-size warning; it does not fail the build.

## Next Phase entry and prerequisites

The next phase may build on the RobotFile library (for example, authentication/authorization, non-JSON ingest, metadata extraction, or dataset management) only after its requirements are defined. PostgreSQL and MinIO must be running, the repository-root `.env` must be configured, and all Prisma migrations must be applied. Any new file type needs explicit MIME, size, parsing/validation, and metadata rules. Do not introduce DVC actions until frozen DatasetVersion publication is explicitly in scope.

## Original phase verification results

- `npx.cmd prisma format`, `npx.cmd prisma validate`, and `npx.cmd prisma generate`: passed.
- `npx.cmd prisma migrate dev --name p1_postgresql_data_models`: created and applied `20260812034734_p1_postgresql_data_models` to local PostgreSQL.
- `npm.cmd run prisma:seed --workspace @cleaning-robot/api`: passed; database verification confirmed `CR-001`, `CR-002`, and `CR-003`.
- `npm.cmd run build`: passed for API and web.
- `npm.cmd run test`: passed; 2 suites and 3 tests, including duplicate-checksum and storage-compensation tests.
- `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`: passed after P2.
# D6 status — implementation delivered, production evidence pending

D6 repository implementation now covers production TLS and MQTT identity policy, Vault-rendered secrets, shared Redis control limits, device certificate APIs, backup/restore evidence, guarded data retention, Web resilience status and operational Runbooks. Schema changes are additive and existing safety/state-machine contracts are unchanged.

Production is not marked accepted: this workstation has no verified production Docker/Vault/PKI/off-site S3 environment or EMQX license approval. The external D6 gates are recorded in the gap analysis and must produce ACL, restore, rollback and mass-reconnect evidence.
