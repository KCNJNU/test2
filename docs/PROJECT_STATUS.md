# Project Status — Phase 2 Complete

## Completed

- Initialized the Git repository and npm workspaces.
- Added NestJS API, React/Vite/Ant Design web shell, PostgreSQL and MinIO Docker Compose services, root environment template, and project documentation.
- Added REST health endpoint (`GET /health`) and Swagger UI (`/api/docs`).
- Added a workspace-independent root `.env` loading path for the API and verified startup from the API workspace.
- Completed P1 PostgreSQL data models and applied migration `20260812034734_p1_postgresql_data_models` locally. The seed is idempotent and creates `CR-001`, `CR-002`, and `CR-003`.
- Completed P2 RobotFile library: JSON multipart upload, indexed metadata persistence, paginated filtering, file lookup, presigned download URLs, and deletion.
- Completed P3 Dataset / DatasetVersion management: datasets, numbered DRAFT versions, version-file selection, immutable freezing, and object-storage manifests.

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

## Verification results

- `npx.cmd prisma format`, `npx.cmd prisma validate`, and `npx.cmd prisma generate`: passed.
- `npx.cmd prisma migrate dev --name p1_postgresql_data_models`: created and applied `20260812034734_p1_postgresql_data_models` to local PostgreSQL.
- `npm.cmd run prisma:seed --workspace @cleaning-robot/api`: passed; database verification confirmed `CR-001`, `CR-002`, and `CR-003`.
- `npm.cmd run build`: passed for API and web.
- `npm.cmd run test`: passed; 2 suites and 3 tests, including duplicate-checksum and storage-compensation tests.
- `npx.cmd prisma validate --schema apps/api/prisma/schema.prisma`: passed after P2.
