# Architecture

PostgreSQL contains metadata and indexes for robots, files, datasets, dataset versions, and version membership. It does not contain raw file binary data.

Raw recognition files live in object storage. The API's domain services depend on the `ObjectStorage` interface; MinIO is the local adapter and OSS will be a production adapter.

## RobotFile library

`RobotFile` records are metadata and indexes only. File bytes are stored through
the `ObjectStorage` contract, which provides object put/get/delete/existence
operations and presigned download URLs. `MinioObjectStorageService` is the
development implementation. `OssStorageAdapter` is currently a contract-only
placeholder; no production OSS connection is configured.

The initial ingestion API accepts multipart JSON files only. It validates a
maximum 10 MiB size, JSON MIME type and extension, and parseability; it computes
a SHA-256 checksum before storage. The service generates the object key as
`raw/{robotCode}/{yyyy}/{MM}/{dd}/{uuid}.json`, stores the object, then creates
the PostgreSQL record. If the database write fails, it deletes the just-stored
object as compensation. The list endpoint deliberately omits `metadata` so
large JSON metadata is not returned as part of result pages.

The canonical development configuration file is the repository-root `.env`. The API resolves this location independently of its current working directory, so root-level and workspace-level npm commands load the same configuration. Required object-storage settings remain fail-fast configuration values.

DVC is intentionally deferred. It will run only when a DatasetVersion is frozen and published, after a manifest and snapshot are generated. Individual file uploads must never trigger DVC or Git actions.

## Dataset versions

Datasets group `RobotFile` metadata into numbered `DatasetVersion` records. A
version is created in `DRAFT` and its member files can be added or removed. On
freeze, the API generates and stores `manifests/{datasetId}/v{version}/manifest.json`,
then persists its key, SHA-256 checksum, file count, total size, and frozen time
with `FROZEN` status. Frozen versions are immutable; changes require a new DRAFT
version. Freezing does not run DVC or create Git commits.

## Dataset publication

Only a `FROZEN` version can be published. Publication downloads its manifest and
member objects into `data/dataset-workspace/{dataset}/{version}`, verifies each
SHA-256 checksum, snapshots that directory with DVC, pushes to the dedicated
`robot-dvc-store` remote, commits the DVC pointer, and tags the commit as
`dataset-{datasetName}-v{version}.0.0`. It then records the Git and DVC references
and changes status to `PUBLISHED`. RobotFile upload never calls this workflow.
See `docs/DATASET_RECOVERY.md` for restoring a version from an empty directory.
