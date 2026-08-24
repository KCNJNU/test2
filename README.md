# Cleaning Robot Recognition Data Platform

用于管理清洁机器人识别数据的元数据、原始文件索引和未来的数据集版本。

## Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop（用于 PostgreSQL、Redis、EMQX、MinIO 和 pgAdmin）

## Local development

1. Copy `.env.example` to the repository-root `.env` (the API always loads this canonical path, including when started from its workspace).
2. Start infrastructure: `docker compose up -d`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npm run prisma:generate --workspace @cleaning-robot/api`.
5. Create the development schema: `npm run prisma:migrate --workspace @cleaning-robot/api -- --name init`.
6. Run the API: `npm run dev --workspace @cleaning-robot/api`.
7. Run the web app: `npm run dev --workspace @cleaning-robot/web`.

For V2 operations, set `BOOTSTRAP_ADMIN_EMAIL` and a password of at least 12 characters, then run `npm run prisma:seed --workspace @cleaning-robot/api`. The development command in step 6 starts both the HTTP API and the durable worker, so resumable uploads can finalize without another terminal. For a production build, run the worker as a separate process:

```powershell
npm run worker --workspace @cleaning-robot/api
```

The first bootstrap Admin must change the temporary password after login. Business APIs require the HttpOnly session cookie and mutation requests require the session CSRF token. `/health`, `/api/v1/auth/login`, and Swagger remain public.

### DVC project runtime

Run `./scripts/bootstrap-dvc.ps1` once. It creates the ignored `.venv-dvc`, installs the pinned `dvc[s3]==3.67.1` dependency set, and adds only missing local DVC keys to `.env`. It never overwrites existing configuration. The raw-file bucket and DVC remote bucket must remain different.

The asynchronous Publish Job performs Validation, Workspace Snapshot, DVC Add, DVC Push, Git Commit/Tag, Persist Version, and Recovery Check. Recovery Verify uses a temporary Git worktree and a targeted `dvc pull`; the health endpoint never pulls data.

### Resumable uploads

`POST /api/v1/uploads` creates a 24-hour session. Parts are 1-based, 8 MiB except the final part, and are uploaded with `PUT /api/v1/uploads/:id/parts/:partNumber` plus `Content-Range` and `X-Part-SHA256`. Completion queues an `UPLOAD_FINALIZE` Job. The worker composes the object, streams the full SHA-256 and format checks, creates `RobotFile` only after storage succeeds, and removes the final object if the database write fails.

The browser stores only resumable session descriptors and completed part state in IndexedDB. It never stores file bytes; after a refresh, the operator must reselect the same name, size, last-modified time and checksum.

API health is available at `http://localhost:3000/health`; Swagger is at `http://localhost:3000/api/docs`. The health response probes PostgreSQL, Redis, EMQX, ObjectStorage, the PostgreSQL job queue, DVC remote, and the worker without returning connection errors or credentials.

The local infrastructure consoles are:

- EMQX Dashboard: `http://localhost:18083`
- MinIO Console: `http://localhost:9001`
- pgAdmin: `http://localhost:5050`

Set `EMQX_DASHBOARD_USERNAME` and `EMQX_DASHBOARD_PASSWORD` in the repository-root `.env`; the values in `.env.example` are placeholders. MQTT listens on port `1883` in DEV. These local ports and credentials must not be reused for TEST, STAGING, or PRODUCTION. Stop the local stack with `docker compose down`; named volumes are retained unless they are explicitly removed.

The Web app uses `VITE_HEALTH_API_BASE_URL` (default `http://localhost:3000`) only for infrastructure health. `VITE_API_BASE_URL` remains the business API endpoint.

### Observability

The NestJS API exports Prometheus metrics at `http://localhost:3000/metrics`. With the Device Gateway enabled, its independent metrics listener defaults to `http://127.0.0.1:9464/metrics`. Start the optional DEV collector with `docker compose --profile observability up -d prometheus`, then open `http://localhost:9090`. JSON logs correlate HTTP and MQTT work with request/trace, robot, task and command identifiers and redact credential fields.

The System Status page also loads an authenticated, tenant-scoped fleet/task/command summary through `VITE_HEALTH_API_BASE_URL`. See `docs/devops/OBSERVABILITY.md` and `docs/devops/SLO_ALERT_RULES.md`. Production log/trace storage and notification routing are intentionally deferred to environment-owned infrastructure.

### Device Gateway and Mock Robot Agent

For D2 development, set `DEVICE_GATEWAY_ENABLED=true` and the documented timeout values in the root `.env`, then start the independent NestJS gateway process:

```powershell
npm run gateway:dev --workspace @cleaning-robot/api
```

To simulate a registered robot, set `MOCK_ROBOT_ID`, the matching `MOCK_ROBOT_SN`, and `MOCK_ROBOT_SCENARIO`, then run `npm run mock-robot:dev --workspace @cleaning-robot/api`. See `docs/devops/DEVICE_GATEWAY.md` and `docs/api/asyncapi.yaml`. The simulator is Development-only and never bypasses robot-side safety.

### pgAdmin

pgAdmin starts with the other infrastructure services. To start only pgAdmin and its PostgreSQL dependency, run `docker compose up -d pgadmin`, then open `http://localhost:5050`.

The local development login defaults are:

- Email: `admin@cleaning-robot.local`
- Password: `pgadmin_dev`

The preconfigured server `Cleaning Robot PostgreSQL` appears under the `Project` group. On the first connection, enter the value of `POSTGRES_PASSWORD` from the repository-root `.env`; the database password is intentionally not stored in `infra/pgadmin/servers.json`.

Within Docker Compose, pgAdmin must connect to PostgreSQL using host `postgres` and port `5432`, not `localhost`. The preconfigured database and user are both `cleaning_robot`. If `POSTGRES_DB` or `POSTGRES_USER` is changed, update `infra/pgadmin/servers.json` to match. `PGADMIN_PORT`, `PGADMIN_DEFAULT_EMAIL`, and `PGADMIN_DEFAULT_PASSWORD` can be overridden in `.env` for local development.

### Robot file object storage checks

Robot file uploads use `POST /api/v1/files` with `multipart/form-data`. The API writes the object to MinIO before creating the `RobotFile` row. In the local environment, inspect the bucket configured by `OBJECT_STORAGE_BUCKET` (`robot-raw-files` by default), not the DVC remote bucket.

MinIO object keys are nested under `raw/<robot-code>/<YYYY>/<MM>/<DD>/<uuid>.json`. When comparing Prisma Studio with MinIO Console, copy the complete `RobotFile.objectKey` and follow that exact prefix; MinIO folders are object-key prefixes rather than physical directories. A database row should only exist after the corresponding object upload succeeds.

Validate the Prisma schema with `npx prisma validate --schema apps/api/prisma/schema.prisma`.

## D4 release pipeline

GitHub Actions now separates CI, immutable image publication/TEST deployment, approved Production promotion and approved rollback. A successful `master` CI run builds Java API, NestJS, Worker, Migration and Web images once, publishes them to GHCR by digest, emits SBOM/provenance, keyless-signs images and a release manifest, and deploys TEST only when its Environment is configured. Production accepts an already verified full commit SHA plus SemVer/release note and never rebuilds it.

Application runtime containers are non-root and read-only. Java, NestJS and Web use blue/green slots; Worker and Device Gateway remain single-active. Rollback selects only the host-recorded previous stable manifest and never reverses Prisma migrations. Host application secrets belong in `deploy/runtime.env.example`-shaped root-only files, not GitHub, Git, images or manifests.

See `docs/devops/CICD_PIPELINE.md`, `docs/devops/CANARY_AND_ROLLBACK.md`, `docs/devops/PRODUCTION_PERMISSION_MATRIX.md` and `docs/runbooks/DEPLOYMENT_ROLLBACK.md`. With no configured TEST/Production host, workflows must report `deployment_not_configured`; that state is not deployment acceptance.

## D5 OTA development

The Java API exposes authenticated software versions, configuration versions and OTA campaigns under `/api/v1`. Software upload calculates and verifies SHA-256 before storage; release rechecks the stored object. L4 Safety configurations require a different authorized approver. Rollout begins with one explicit robot and broad project release is gated on a successful canary.

Set `MOCK_ROBOT_SCENARIO` to `OTA_SUCCESS`, `OTA_CHECKSUM_FAILURE` or `OTA_BOOT_FAILURE` and run the Development Mock Robot Agent to exercise status evidence. The Web route `/versions-platform` displays artifacts, approval state, campaigns, checksums, progress and rollback results. See `docs/devops/OTA_RELEASE.md` and `docs/api/asyncapi.yaml`. The simulator is not evidence of real-device installation; production signing private keys and the real Robot Agent installer remain external.

## Storage and versioning boundaries

PostgreSQL stores only file metadata and `objectKey`; MinIO/OSS stores raw files. Application services rely on the `ObjectStorage` interface rather than a vendor SDK. DVC and Git snapshot operations are reserved for future frozen DatasetVersion publication and are not part of this first phase. See [architecture notes](docs/architecture.md).
# D6 production hardening

Production assets live under `deploy/emqx`, `deploy/vault`, `deploy/backup` and the production Compose overlays. They require Vault-rendered root-only files and immutable image digests; the checked-in examples contain placeholders only. See `docs/devops/SECRET_MANAGEMENT.md`, `docs/devops/BACKUP_RESTORE.md` and `docs/runbooks/INCIDENT_RESPONSE.md` before provisioning. DEV continues to use the root `.env` and local EMQX without production certificates.
