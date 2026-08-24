# V2 UI Audit

Audit date: 2026-08-16

| Page / Area | Current Problems | V2.0-A Changes | Backend Dependency | Status | Validation |
| --- | --- | --- | --- | --- | --- |
| Application shell | Navigation is component state, has no deep links, and header actions are infrastructure-only | React Router, dense grouped navigation, global actions, command palette, URL-backed drawers | Health API, global search | Implemented A | Ctrl+K, URL drawer and 1366/1920 viewport checks passed |
| Dashboard | Loads whole collections and derives a small set of totals in the browser | Aggregated operations API, ingestion trend, robot data activity, pipeline and real recent records | New dashboard aggregate API | Implemented A | HTTP results matched PostgreSQL-backed counts |
| Robots | Loads every robot, filters locally, and has no detail workflow or create action | Server page/search/sort, data-activity state, add robot and detail drawer | New compatible robot endpoints | Implemented A | API/unit/browser checks passed |
| Files | Text search only filters the current page; no selection, grid view or dataset shortcut | Server search/filter/sort, URL state, table/grid, detail drawer, bulk export/delete/add-to-dataset | Extended existing Files API | Implemented A | Real upload/download/delete and MinIO fault test passed |
| Upload | Single-file modal with no queue or progress | Dedicated multi-file upload center with hashing, duplicate preflight, progress, cancel and retry | Existing upload plus checksum query | Implemented A | Queue tests and ObjectStorage integration passed |
| Datasets | Large cards and combined management drawers | Server paging/filtering plus dedicated full-page Dataset Workspace | Dataset page/detail and clone-version APIs | Implemented B | Unit, component and real HTTP read-only checks |
| Dataset Versions | Loads all datasets and filters versions locally | Server inventory, timeline, staged Builder, on-demand Validation and same-Dataset Compare | Version pages, atomic membership, validate and compare APIs | Implemented B | Membership/manifest/Freeze/compare tests and viewport checks |
| Storage | Health summary only | Keep accurate raw/DVC separation | Existing health API | Existing; explorer/reconciliation in D | Health smoke test |
| System Status | Real dependency status without latency/detail drill-down | Keep current accurate state model | Existing health API | Existing; details in D | Health tests |
| Jobs / Notifications / Audit | No models or APIs | Show honest Not Enabled affordances only | New additive models required | Deferred C/D | Feature matrix gate |
| Users / Roles | No authentication or actor identity | Display Local Session, no fake user | Authentication and RBAC required | Deferred V2.1 | Security design required |

## Baseline Architecture Findings

- Before V2.0-A, `App.tsx` switched seven pages with local state; there was no router or URL-preserved filter state.
- Before V2.0-A, requests were managed by page-level effects and mutations reloaded only the current page. V2.0-B moves Dataset and DatasetVersion inventory/workspaces to TanStack Query with resource-level invalidation.
- Before V2.0-A, `GET /api/v1/files` was paginated but filename/checksum text search was client-only on the current page. Files, Robots, Datasets and Dataset Versions now use server filtering and allowlisted sorting.
- The Prisma schema contains Robot, RobotFile, Dataset, DatasetVersion and DatasetVersionFile only. V2.0-A therefore does not advertise persisted jobs, notifications, audit events, users, tags or archives.
- Robot telemetry is not stored. V2.0-A uses explicitly named data-activity states derived from real upload timestamps, never online/offline device status.
- Object bytes remain behind `ObjectStorage`; metadata remains in PostgreSQL. File upload, freeze and publish ordering is preserved.

## V2.0-A Guardrails

- No Prisma migration or existing response removal.
- No mock KPI, job, notification, robot telemetry, DVC or Git data.
- No DVC/Git action during RobotFile upload or DRAFT editing.
- Client preferences may use local storage; business entities and workflow state may not.
- V2.0-B/C/D features remain documented, not partially simulated.

## V2.0-B Delivery Notes

- New routes: `/datasets/:datasetId`, `/datasets/:datasetId/versions/:versionId`, and `/datasets/:datasetId/compare?base=&target=`. Legacy `?dataset=` and `?version=` links redirect into the workspace.
- DRAFT membership is staged in the browser and saved only through the atomic full-replacement API. Non-DRAFT versions are read-only, and unsaved changes are guarded for workspace navigation and browser unload.
- Validation is an immediate, non-persisted report. It performs real ObjectStorage reads with concurrency 3 and a 15-second total timeout per object; it does not expose credentials.
- Freeze reuses complete validation. Existing synchronous Publish/DVC behavior is preserved without fake jobs or progress.
- Compare uses RobotFile ID identity and reports only added, removed and unchanged members.
- No Prisma schema or migration was added. V2.0-C, V2.0-D and V2.1 remain deferred exactly as listed in the feature matrix.
