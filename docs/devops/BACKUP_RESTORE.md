# Backup and Restore

## Objectives and protected data

- PostgreSQL: hourly custom-format dump, RPO 1 hour.
- Object data: export every 6 hours, RPO 6 hours.
- Platform recovery: RTO 4 hours.
- Destination: encrypted Restic repository in an independent S3-compatible account, bucket and failure domain.

Database protection includes users/permissions, projects, robot registration and certificate metadata, maps, tasks, SAFE/fault events, audit data, jobs and version information. Object protection includes raw files, maps, software artifacts, diagnostics and DVC snapshots. The staging volume must be dedicated, mode `0700`, and at least 120% of protected object size.

`deploy/backup/backup.sh database` runs hourly; `objects` runs every six hours. Images and the active Restic repository are digest/config pinned. Vault supplies database, source storage and append-only destination credentials. Backup completion is reported to the internal resilience endpoint; Edge returns 404 for that endpoint.

## Integrity and retention

Retain 24 hourly, 35 daily, 12 monthly and 3 yearly snapshots. The backup identity cannot delete snapshots. A distinct maintenance identity runs `maintenance.sh`; pruning requires a successful dry-run and explicit `APPLY_BACKUP_RETENTION=true`. Run `check.sh` daily and `RESTIC_READ_DATA=true check.sh` monthly.

Alerts fire when the latest successful database evidence is older than one hour, object evidence is older than six hours, a snapshot fails, a repository check fails, or no successful restore drill exists within 35 days. Losing `RESTIC_PASSWORD` makes the repository unrecoverable, so its recovery procedure must be separately escrowed and tested.

## Restore drill

Run `restore-drill.sh` monthly on an isolated host/database and scratch object namespace. The script refuses the production database URL and any target outside `/var/lib/robot-platform-restore`. It restores the latest snapshot, executes `pg_restore`, checks Prisma migrations and Tenant/Robot queries, then verifies SHA-256 manifests. Evidence is appended to `audit/restore-drills.jsonl` and reported to the platform without secrets.

Never run reverse migrations. Application rollback must use a schema-compatible release. Do not remove the isolated target until evidence has been recorded; after the absolute-path guard succeeds, the drill scratch directory may be deleted. A restore is accepted only when database schema, tenant counts, sampled objects and checksums pass and the elapsed time stays below four hours.

## Data lifecycle

Audit data is retained 2 years; completed Fault/Task data 1 year; raw telemetry 30 days; health/telemetry aggregates 1 year; application logs and diagnostics 90 days. A `SUPER_ADMIN` must review the preview and submit `APPLY_RETENTION_POLICY`. Cleanup is blocked unless database/object backups are within RPO and the latest restore drill is at most 35 days old. Frozen DVC publications are excluded by default.
