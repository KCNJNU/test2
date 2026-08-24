# Public API

The API is served below `/api`; Swagger remains available at `/api/docs`. V2.0-B only adds compatible Dataset Workspace resources. Existing Dataset, freeze and publish URLs remain unchanged.

## Dataset workspace

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/datasets/page` | Dataset paging, name/description search, version-status filtering and whitelisted sorting |
| `GET` | `/api/v1/datasets/versions/page` | Global DatasetVersion paging, dataset/status/search filters and whitelisted sorting |
| `POST` | `/api/v1/datasets/:datasetId/versions` | Create a DRAFT from `fileIds`, `sourceVersionId`, or an empty membership |
| `GET` | `/api/v1/datasets/versions/:id/files` | Page the current version membership |
| `GET` | `/api/v1/datasets/versions/:id/candidates` | Page RobotFiles not currently in the version |
| `PUT` | `/api/v1/datasets/versions/:id/files` | Atomically replace the complete DRAFT membership |
| `POST` | `/api/v1/datasets/versions/:id/validate` | Calculate a non-persisted integrity report |
| `GET` | `/api/v1/datasets/:datasetId/versions/compare` | Compare two versions in the same Dataset by immutable RobotFile ID |

List query parameters are validated DTOs. Sort fields are explicit allowlists; invalid fields receive HTTP 400. Version member/candidate lists support `search`, `robotId`, `recognitionType`, `schemaVersion`, `startTime`, `endTime`, `sortBy`, `sortOrder`, `page`, and `pageSize`.

Version creation accepts exactly one starting-membership strategy:

```json
{ "fileIds": ["robot-file-uuid"] }
```

or:

```json
{ "sourceVersionId": "dataset-version-uuid" }
```

`sourceVersionId` must refer to the same Dataset. Omitting both values creates an empty DRAFT. Supplying both returns HTTP 400.

## Validation response

Validation reads real ObjectStorage content with concurrency 3 and a 15-second total timeout per object. It recalculates byte length and SHA-256. FROZEN and PUBLISHED versions also verify the stored manifest, membership and persisted aggregates. Reports are not persisted and never contain storage credentials.

```json
{
  "versionId": "uuid",
  "status": "DRAFT",
  "valid": false,
  "validatedAt": "2026-08-16T00:00:00.000Z",
  "summary": {
    "files": 1,
    "totalSize": "128",
    "checkedObjects": 0,
    "errors": 1,
    "warnings": 0
  },
  "issues": [
    {
      "code": "OBJECT_MISSING",
      "severity": "error",
      "fileId": "uuid",
      "objectKey": "raw/robot/date/file.json",
      "message": "ObjectStorage object is not reachable"
    }
  ]
}
```

Freeze invokes the same complete validation. Errors return HTTP 409 and prevent manifest creation; warnings do not block. FROZEN, PUBLISHED and ARCHIVED membership replacement returns HTTP 409.

## Compare response

`baseVersionId` and `targetVersionId` are required UUID query parameters. The response contains version summaries, `added`, `removed`, and `unchanged` RobotFiles, plus `totalSizeDelta`. There is deliberately no `modified` class because RobotFile references are immutable.

## RobotFile deletion integrity

`DELETE /api/v1/files/:id` returns HTTP 409 before deleting ObjectStorage content when any DatasetVersion still references the RobotFile.

## V2 operations and security

All routes except `/health`, `/api/v1/auth/login`, and Swagger require the opaque HttpOnly session cookie. Mutations also require `X-CSRF-Token`. Roles are `ADMIN`, `OPERATOR`, and `VIEWER`; Viewer is read-only.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Create an opaque 12-hour session |
| `GET` | `/api/v1/auth/session` | Return current user and rotate CSRF token |
| `POST` | `/api/v1/datasets/versions/:id/publish-jobs` | Queue durable publish (202) |
| `POST` | `/api/v1/datasets/versions/:id/recovery-jobs` | Queue targeted recovery verification (202) |
| `GET` | `/api/v1/jobs/page` | Page durable Jobs |
| `GET` | `/api/v1/jobs/:id` | Read ordered execution steps |
| `POST` | `/api/v1/jobs/:id/retry` | Retry a failed Job from its failed step |
| `POST` | `/api/v1/jobs/:id/cancel` | Request cancellation at a step boundary |
| `GET` | `/api/v1/activity/page` | Aggregate AuditLog and Job activity |
| `GET` | `/api/v1/notifications` | Page the current user's notifications |
| `GET` | `/api/v1/storage/objects` | Browse bucket objects through ObjectStorage |
| `POST` | `/api/v1/storage/reconciliation-runs` | Queue a storage scan (202) |
| `POST` | `/api/v1/storage/orphan-deletion-jobs` | Admin-only confirmed orphan deletion |
| `GET` | `/api/v1/system/configuration` | Return settings and redacted infrastructure state |
| `GET` | `/api/v1/audit-logs/page` | Admin-only immutable audit history |
| `GET` | `/api/v1/tags` | List file/dataset tags |
| `GET` | `/api/v1/saved-views` | List personal and shared allowlisted views |

## Resumable upload

`POST /api/v1/uploads` creates a 24-hour session with an 8 MiB `chunkSize`. A part request uses `application/octet-stream`, a 1-based part number, exact `Content-Range`, and `X-Part-SHA256`. `POST /api/v1/uploads/:id/complete` returns HTTP 202 with the Upload Finalize Job. The worker composes and streams validation before creating RobotFile. Neither health nor upload responses contain storage credentials.
