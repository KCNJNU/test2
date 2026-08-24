# V2 Feature Matrix

| Feature | Frontend | API | DB | ObjectStorage | DVC / Git | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Routed enterprise shell | Router, grouped nav, header actions | Health | Existing | None | None | V2.0-A |
| Global search / command palette | Ctrl+K grouped results and commands | Aggregated bounded search | Existing indexes/models | None | Reads Git reference fields only | V2.0-A |
| Operations dashboard | KPI, trend, robot activity, pipeline | Server aggregates | Existing models | Managed bytes from RobotFile metadata | Current status fields only | V2.0-A |
| Fleet management | Page, filters, create, detail drawer | Robot page/detail/create | Existing Robot/RobotFile relations | None | None | V2.0-A |
| Files workbench | Server filters, table/grid, details, bulk actions | Extended Files list/detail | Existing RobotFile | Preview/download/delete via abstraction | None | V2.0-A |
| Upload center | Hash, duplicate check, progress, cancel/retry | Existing multipart upload plus checksum query | Existing RobotFile metadata | Existing compensated upload | Never invoked | V2.0-A |
| Add files to dataset | Inline drawer from Files | Reuses dataset/version membership APIs | Existing membership model | None | None while DRAFT | V2.0-A |
| Dataset workspace / builder | Full-page workspace, timeline and atomic staged builder | Dataset/version pages, member/candidate pages, clone and replace | Existing DatasetVersionFile relation | None while editing | Existing publish boundary unchanged | Implemented V2.0-B |
| Version validation / compare | On-demand report, Freeze gate and same-Dataset diff | Validate/compare resources | Existing metadata and aggregates | Real object byte/SHA-256 and manifest reads | Read-only references; existing publish action preserved | Implemented V2.0-B |
| Referenced RobotFile deletion guard | Existing confirmation receives conflict detail | Existing delete now checks membership first | Existing DatasetVersionFile relation | Object is not touched on conflict | None | Implemented V2.0-B |
| Publish operations | Validation gate, step progress, retry/cancel and recovery action | Job-backed step API | Additive Job/step/lease state | Snapshot reads | DVC push, Git commit/tag and targeted recovery pull | Implemented V2.0-C |
| Jobs / activity / notifications | Centers and live notification drawer | Resource APIs | Durable Job, AuditLog and Notification | Task-specific | Task-specific | Implemented V2.0-C |
| Storage explorer / reconciliation | Prefix browser and repair review | Object/reconciliation APIs | Persisted runs and issues | List/stat/compose/batch delete through abstraction | Separate DVC remote | Implemented V2.0-D |
| System detail / settings / audit | Worker status, allowlisted settings, users and audit | Health detail/settings/audit | Immutable audit and typed settings | Safe probes only | Safe remote probe | Implemented V2.0-D |
| Users / roles | Session and permission-aware routes/navigation | Opaque-cookie authentication, CSRF and RBAC | User/session lockout and revocation | No client secrets | Server-side authorization | Implemented V2.1 |
| Tags / saved-view sync / resumable upload | Tag endpoints, shared/personal views and IndexedDB upload resume | Dedicated APIs | Additive models | 8 MiB part objects, server compose and compensated finalize | None | Implemented V2.1 |

The previous `Not Enabled` placeholders for Jobs and Notifications have been removed because they now have persisted backing models and APIs.
