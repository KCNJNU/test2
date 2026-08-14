# Cleaning Robot Recognition Data Platform

用于管理清洁机器人识别数据的元数据、原始文件索引和未来的数据集版本。

## Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop（用于 PostgreSQL 和 MinIO）

## Local development

1. Copy `.env.example` to the repository-root `.env` (the API always loads this canonical path, including when started from its workspace).
2. Start infrastructure: `docker compose up -d`.
3. Install dependencies: `npm install`.
4. Generate Prisma client: `npm run prisma:generate --workspace @cleaning-robot/api`.
5. Create the development schema: `npm run prisma:migrate --workspace @cleaning-robot/api -- --name init`.
6. Run the API: `npm run dev --workspace @cleaning-robot/api`.
7. Run the web app: `npm run dev --workspace @cleaning-robot/web`.

API health is available at `http://localhost:3000/health`; Swagger is at `http://localhost:3000/api/docs`. The MinIO console is at `http://localhost:9001`.

Validate the Prisma schema with `npx prisma validate --schema apps/api/prisma/schema.prisma`.

## Storage and versioning boundaries

PostgreSQL stores only file metadata and `objectKey`; MinIO/OSS stores raw files. Application services rely on the `ObjectStorage` interface rather than a vendor SDK. DVC and Git snapshot operations are reserved for future frozen DatasetVersion publication and are not part of this first phase. See [architecture notes](docs/architecture.md).
