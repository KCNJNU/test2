# Cleaning Robot Recognition Data Platform

## Technology boundaries

- Backend: NestJS and TypeScript. Frontend: React, TypeScript, Vite, and Ant Design.
- PostgreSQL is the only application database. Never add SQLite or use it for local development.
- Prisma owns application schema access and migrations.
- Raw files are stored outside PostgreSQL. Database records store `objectKey`, metadata, indexes, and version state only.
- Business services depend on the `ObjectStorage` interface, never a MinIO, OSS, or other storage SDK directly.
- MinIO is the development storage implementation; OSS is a production implementation.

## Dataset versioning

- DVC applies only after a DatasetVersion is frozen.
- Do not run `dvc add` or create Git commits for individual robot file uploads.
- Dataset publication will later generate a manifest and snapshot, then run DVC push and create a Git commit/tag.

## Scope discipline

- First-phase file support begins with JSON but must preserve MIME type, filename, extension, size, and arbitrary metadata for future JPG, PNG, PCD, map, and log files.
- Keep API routes RESTful and document public endpoints with Swagger.
- Do not implement RobotFile upload, background file processing, DVC commands, or dataset publishing unless explicitly requested.

## Configuration and verification

- The canonical development environment file is the repository-root `.env`. API configuration must load it using a path that is independent of the npm workspace working directory.
- Keep required infrastructure settings explicit with `ConfigService.getOrThrow`; do not replace missing configuration with hard-coded business defaults.
- Before closing a phase that changes application code or Prisma schema, run the root build and test commands plus `npx prisma validate --schema apps/api/prisma/schema.prisma`.
