# Requirement Gap Analysis

Updated: 2026-08-23

This audit compares the commercial cleaning-robot Java and Web/App requirements with the current RobotHygienism repository. The worktree already contains substantial user changes; implementation must remain additive and must not reset or replace them.

| Requirement | Current capability | Reuse | Required change | Risk / dependency | Acceptance |
| --- | --- | --- | --- | --- | --- |
| Tenant/project/site/floor | None | Existing UUID/PostgreSQL conventions | Add hierarchy, grants and scope filters | Existing records need deterministic LEGACY backfill | Cross-tenant IDs return 404 |
| Authentication/RBAC | NestJS opaque cookie, CSRF, ADMIN/OPERATOR/VIEWER | User, Session, Argon2id | Add six formal roles, permissions, project grants and Java-compatible sessions | Preserve current Web login | Sessions work across Java and NestJS |
| Robot operations | Robot is currently a data-source record | Existing Robot UUID and file relations | Add binding, canonical state, battery, versions and online timestamps | Never infer physical stop from OFFLINE | No heartbeat means OFFLINE and unknown metrics remain null |
| Device gateway | None | Request-id and worker patterns | MQTT adapter, inbox/outbox, ACK, reconnect and simulator | Real broker credentials and Robot Agent unavailable | Simulator proves duplicate/ordering/reconnect cases |
| Task lifecycle | None | PostgreSQL transactions | MissionTemplate, Task, TaskRun, events and transition service | PAUSED and BLOCKED must remain distinct | Illegal transitions are rejected |
| SAFE/fault | None | Audit infrastructure | Data-driven policy, SafetyState, FaultEvent, acknowledge and maintenance | Full SAFE product matrix is not supplied | Unknown SAFE fails closed; acknowledge never resets safety |
| Maps/zones | None | ObjectStorage abstraction pattern | Map versions, GeoJSON zones, validation and publication | Robot map format is not frozen | Only PUBLISHED versions can start tasks |
| OTA/config | None | Jobs and object metadata patterns | Version catalogs, OTA jobs, checksum and rollback states | Real installer is Robot Agent-owned | Simulator covers success/failure/rollback |
| Reports | Dataset dashboard only | Query/paging patterns | Task/fault/runtime aggregates with capability flags | Cleaning-area definition incomplete | Unsupported metrics return NOT_AVAILABLE |
| Realtime Web/App | Polling only | React Query | SSE event stream, staleness and reconnect handling | Mobile background delivery needs push provider | UI never treats HTTP 200 as robot acceptance |
| Web operations UI | Data-management console | React/Vite/Ant Design shell | Add fleet/task/map/alarm/maintenance/version/report modules | Preserve existing pages | Existing and new routes build and test |
| Mobile app | None | React/TypeScript knowledge | Expo application with device/task/alarm/profile tabs | Signed store builds need external credentials | Source, tests and development config pass |
| Data management | Implemented in NestJS | Files, uploads, datasets, MinIO, DVC | Keep as internal bounded context behind Java | Shared session and tenant scope | No regression in existing tests |

## External acceptance gates

- Production MQTT endpoint, CA/client certificates and ACL rules.
- Field-level Robot Agent schema and timeout/heartbeat thresholds.
- Complete SAFE-000 through SAFE-405 product-operation matrix.
- Real map binary format, localization coordinate convention and robot-side version handshake.
- OTA package signing keys, hardware compatibility catalog and rollback implementation.
- Android/iOS signing identities and store accounts.

## DevOps D1-D6 audit

The DevOps audit treats the development brief as product requirements, while repository `AGENTS.md` remains the engineering boundary. New backend work is NestJS; existing Java sources are not expanded by D1.

| Requirement / phase | Current capability | Direct reuse | Extension required | New capability required | Risk | Dependency | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 Local / DEV foundation | Compose defines PostgreSQL, Redis, MinIO, pgAdmin and EMQX 5.8.8; Nest health reports every D1 dependency | Existing root `.env`, Prisma, ObjectStorage, worker heartbeat and Web status page | Maintain explicit configuration and accurate four-state health display | Dedicated Redis PING, MQTT CONNECT and PostgreSQL job-queue probes | Docker is not currently available in the development shell, so runtime container verification remains environment-gated | Docker Desktop or compatible Compose runtime | Compose services become healthy; `/health` reports API, DB, Redis, MQTT, storage, queue and worker without secrets |
| Environment isolation | Root `.env` is canonical for DEV; environment contract is documented | Existing environment loading and ignored `.env` | Provision distinct endpoints, data stores, credentials and certificates per environment | Managed secrets and deployment-specific configuration for TEST/STAGING/PRODUCTION | Accidental cross-environment endpoint or secret reuse | Cloud accounts, Secret Manager/Vault, production ownership | DEV cannot resolve or authenticate to production resources; promotion uses environment-owned secrets |
| D2 Device Gateway | NestJS gateway process now implements MQTT adapter, registered ID/SN checks, Inbox/Outbox, ACK, heartbeat leases, reconnect, version routing, deduplication and sequence reconciliation; development Mock Agent covers required scenarios | PostgreSQL models, command safety contracts and EMQX DEV broker | Field-test payload details and tune heartbeat/ACK thresholds with the real Robot Agent | Production device certificates and per-robot broker ACL | Robot Agent field contract and timeout thresholds are not frozen | Production broker CA/certificates and Robot Agent contract | Unit tests cover identity/schema/dedup/order/safety guard; broker ACL and real reconnect remain external gates |
| D3 Observability | JSON logs, bounded HTTP/MQTT/process/business Prometheus metrics, trace/request propagation, tenant-scoped Web signals, DEV Prometheus profile and alert rules are implemented | Audit interceptor, health probes, Nest process boundaries and System Status page | Tune SLOs/thresholds with real traffic and propagate trace context through the existing Java business API | Production log/trace stores, Alertmanager routing, retention and HA | Cardinality, secret leakage and assuming cloud loss means physical stop | Production monitoring platform and on-call ownership | API/Gateway metrics scrape; trace IDs correlate logs; Web scope is tenant-safe; rule syntax and failure scenarios pass |
| D4 CI/CD | Four workflows now cover CI, one-time GHCR builds, optional TEST deployment, approved Production promotion and approved rollback; digest manifests, OCI identity, SBOM/provenance/signing, hardened images and blue-green host automation are present | npm workspaces, Maven wrapper, health/metrics, PostgreSQL Job heartbeat and existing service Docker build patterns | Configure GitHub Environments/required reviewers and tune the reviewed High baseline before expiry | Execute real TEST, Production and rollback drills on isolated hosts | A migration that is syntactically allowed can still break the previous application; singleton replacement is a brief availability boundary | GHCR, TEST/PRODUCTION Compose hosts, approvers, host GHCR read-only identity and runtime secret files | Static/unit/config gates pass locally; TEST must show matching digests/commit, Worker heartbeat and Gateway connected; Production rollback must restore the recorded previous release without schema downgrade |
| D5 OTA / Config | Java now registers immutable artifacts/configs, checks SHA-256 on upload and release, optionally verifies Ed25519, enforces OTA preconditions and canary-before-project selection; Nest records the strict OTA event state machine; Web shows approvals, campaigns, progress and rollback | ObjectStorage abstraction, tenant/RBAC/audit, Command Outbox, MQTT Inbox and Robot facts | Field-validate compatibility/battery rules and production trust-key rotation | Real Robot Agent atomic installer, boot-slot health validation and production signing service | Hardware catalog, private signing custody and device recovery implementation are external | Package signing owner, real Robot Agent and test hardware | Unit/static gates prove checksum cannot skip to install, explicit single target, L4 independent approval and simulated boot rollback; hardware recovery remains external acceptance |
| D6 Production hardening | Repository reference implementation now includes HTTPS, EMQX mutual TLS/default-deny ACL, public-only device certificate inventory and Vault-assisted revocation, Vault Agent templates/policies, Redis shared control limits, tenant-scope enforcement, immutable backup/restore automation, resilience evidence, guarded retention and incident Runbooks | Auth, scope/audit services, PostgreSQL Jobs, ObjectStorage abstraction, health/status UI and D4 digest-only deployment | Provision real PKI/CRL, Vault AppRole, independent backup account and management networks; tune limits and execute the full tenant matrix against production-like data | Production evidence, legal approval for EMQX 6.1.4, off-site snapshots and an accepted HA decision for the single-node broker | Static configuration can be correct while ACL, revocation, restore, rotation or mass reconnect fails in the target environment | Production Docker hosts, domain/PKI, Vault, off-site S3-compatible storage, security/compliance owners and EMQX license review | Local build/lint/test, schema/migration/config/secret gates pass; production acceptance additionally requires HTTPS/mTLS/ACL/CRL, least privilege, rotation, RPO/RTO restore, rollback and 100-client reconnect evidence |

### D1 completion boundary

D1 does not publish robot commands, subscribe to robot topics, change `/cmd_vel`, implement Device Gateway message handling, add production TLS/ACL, or claim production readiness. EMQX connectivity is a protocol-level health probe only. Local cloud/API/MQTT loss has no authority over robot-side `safety_stop`, hardware emergency stop, MCU safety, obstacle detection, or SAFE latches.

### D3 completion boundary

D3 supplies local collection contracts, structured correlation, bounded metric labels, Web operational signals and executable Prometheus rules. It does not claim production notification delivery, full distributed tracing across the Java API, long-term retention or production SLO attainment. Metrics and alerts describe cloud/control-plane state only; `Cloud Down ≠ Safety Down` remains invariant.

### D4 completion boundary

D4 delivers configurable workflows, immutable release evidence, hardened runtime definitions and deployment/rollback automation. It does not claim TEST or Production acceptance until isolated hosts and GitHub Environments are configured and the runbook drill has succeeded. MQTT TLS/ACL, managed Secret Manager integration, backup/restore, OTA and production tenant hardening remain D5/D6. Database rollback is deliberately absent; releases must preserve old-application compatibility through expand → backfill/dual-read → contract.

### D5 completion boundary

D5 supplies the cloud release control plane, integrity gates, independent L4 approval, explicit gray targeting, device status contract, simulated failure/recovery evidence and operator UI. It does not claim a real robot has atomically installed or recovered an artifact. Production signing private keys, trust-key lifecycle, hardware compatibility certification and the Robot Agent boot-slot installer are external gates. MQTT TLS/ACL, managed secrets and backup/restore remain D6.
# D6 production hardening status

Implemented in repository: production TLS/EMQX reference Compose, certificate ACL policy, Gateway fail-closed TLS validation, Vault Agent templates/policies, device-certificate metadata/revocation API, Redis distributed control limits, resilience evidence API, guarded retention Job, Restic backup/check/restore scripts, Web health cards and incident/backup/Secret documentation.

External acceptance gates remain: obtain and legally approve the EMQX 6.1.4 platform digest/license; provision production Vault/AppRole/PKI and domain certificates; create independent append-only S3 credentials; exercise ACL/CRL, HTTPS deployment, database/object restore and 100-client reconnect on real hosts. Single-node EMQX does not satisfy HA and must be explicitly accepted or replaced before the production availability sign-off.
