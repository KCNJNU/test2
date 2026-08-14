-- CreateEnum
CREATE TYPE "DatasetVersionStatus" AS ENUM ('DRAFT', 'FROZEN', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Robot" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Robot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotFile" (
    "id" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "recognitionType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" UUID NOT NULL,
    "datasetId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DatasetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "manifestKey" TEXT,
    "manifestChecksum" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "gitCommit" TEXT,
    "gitTag" TEXT,
    "dvcPath" TEXT,
    "dvcHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "frozenAt" TIMESTAMP(3),

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetVersionFile" (
    "datasetVersionId" UUID NOT NULL,
    "robotFileId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetVersionFile_pkey" PRIMARY KEY ("datasetVersionId","robotFileId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Robot_externalId_key" ON "Robot"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "RobotFile_objectKey_key" ON "RobotFile"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "RobotFile_checksum_key" ON "RobotFile"("checksum");

-- CreateIndex
CREATE INDEX "RobotFile_robotId_capturedAt_idx" ON "RobotFile"("robotId", "capturedAt");

-- CreateIndex
CREATE INDEX "RobotFile_recognitionType_capturedAt_idx" ON "RobotFile"("recognitionType", "capturedAt");

-- CreateIndex
CREATE INDEX "RobotFile_createdAt_idx" ON "RobotFile"("createdAt");

-- CreateIndex
CREATE INDEX "RobotFile_fileType_idx" ON "RobotFile"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_name_key" ON "Dataset"("name");

-- CreateIndex
CREATE INDEX "DatasetVersion_status_idx" ON "DatasetVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_datasetId_version_key" ON "DatasetVersion"("datasetId", "version");

-- CreateIndex
CREATE INDEX "DatasetVersionFile_robotFileId_idx" ON "DatasetVersionFile"("robotFileId");

-- AddForeignKey
ALTER TABLE "RobotFile" ADD CONSTRAINT "RobotFile_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersionFile" ADD CONSTRAINT "DatasetVersionFile_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersionFile" ADD CONSTRAINT "DatasetVersionFile_robotFileId_fkey" FOREIGN KEY ("robotFileId") REFERENCES "RobotFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
