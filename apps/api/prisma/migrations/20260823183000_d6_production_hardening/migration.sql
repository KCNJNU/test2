-- D6 is additive so the previous application release remains runnable after migration.
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'RETENTION_CLEANUP';

CREATE TYPE "DeviceCertificateStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "BackupEvidenceType" AS ENUM ('DATABASE_BACKUP', 'OBJECT_BACKUP');
CREATE TYPE "ResilienceEvidenceStatus" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "DeviceCertificate" (
  "id" UUID NOT NULL,
  "robotId" UUID NOT NULL,
  "certificatePem" TEXT NOT NULL,
  "fingerprintSha256" TEXT NOT NULL,
  "serialNumber" TEXT NOT NULL,
  "subjectCn" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "notBefore" TIMESTAMP(3) NOT NULL,
  "notAfter" TIMESTAMP(3) NOT NULL,
  "status" "DeviceCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
  "registeredById" UUID NOT NULL,
  "revokedById" UUID,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupEvidence" (
  "id" UUID NOT NULL,
  "type" "BackupEvidenceType" NOT NULL,
  "status" "ResilienceEvidenceStatus" NOT NULL,
  "snapshotId" TEXT,
  "sourceHost" TEXT,
  "checksum" TEXT,
  "objectCount" BIGINT,
  "totalBytes" BIGINT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestoreDrill" (
  "id" UUID NOT NULL,
  "status" "ResilienceEvidenceStatus" NOT NULL,
  "snapshotId" TEXT,
  "sourceHost" TEXT,
  "checksum" TEXT,
  "objectCount" BIGINT,
  "totalBytes" BIGINT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestoreDrill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceCertificate_fingerprintSha256_key" ON "DeviceCertificate"("fingerprintSha256");
CREATE UNIQUE INDEX "DeviceCertificate_robotId_serialNumber_key" ON "DeviceCertificate"("robotId", "serialNumber");
CREATE INDEX "DeviceCertificate_robotId_status_notAfter_idx" ON "DeviceCertificate"("robotId", "status", "notAfter");
CREATE INDEX "BackupEvidence_type_status_completedAt_idx" ON "BackupEvidence"("type", "status", "completedAt");
CREATE INDEX "RestoreDrill_status_completedAt_idx" ON "RestoreDrill"("status", "completedAt");

ALTER TABLE "DeviceCertificate" ADD CONSTRAINT "DeviceCertificate_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceCertificate" ADD CONSTRAINT "DeviceCertificate_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceCertificate" ADD CONSTRAINT "DeviceCertificate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" (code, description) VALUES
  ('DEVICE_IDENTITY_MANAGE', 'manage device certificate identity'),
  ('RESILIENCE_MANAGE', 'manage backup restore and retention controls')
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RoleDefinition" (code, "displayName", deprecated, "updatedAt") VALUES
  ('SUPER_ADMIN', 'SUPER ADMIN', false, CURRENT_TIMESTAMP),
  ('ADMIN', 'ADMIN', true, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "RolePermission" ("roleCode", "permissionCode") VALUES
  ('SUPER_ADMIN', 'DEVICE_IDENTITY_MANAGE'),
  ('SUPER_ADMIN', 'RESILIENCE_MANAGE'),
  ('ADMIN', 'DEVICE_IDENTITY_MANAGE'),
  ('ADMIN', 'RESILIENCE_MANAGE')
ON CONFLICT ("roleCode", "permissionCode") DO NOTHING;
