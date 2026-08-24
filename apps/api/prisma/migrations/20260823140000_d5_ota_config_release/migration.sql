-- D5 is additive so the previous application remains compatible during rollback.
CREATE TYPE "ArtifactStatus" AS ENUM ('VERIFIED', 'REVOKED');
CREATE TYPE "ConfigApprovalStatus" AS ENUM ('APPROVED', 'PENDING_APPROVAL', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ConfigApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "OtaRolloutStrategy" AS ENUM ('SINGLE', 'SELECTED_BATCH', 'PERCENTAGE', 'PROJECT');
CREATE TYPE "OtaCampaignStatus" AS ENUM ('READY', 'RUNNING', 'SUCCEEDED', 'PARTIALLY_FAILED', 'FAILED', 'ROLLING_BACK', 'ROLLED_BACK', 'CANCELLED');
CREATE TYPE "OtaEventSource" AS ENUM ('PLATFORM', 'ROBOT_AGENT');

ALTER TABLE "SoftwareVersion"
ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN "fileSize" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "signatureAlgorithm" TEXT,
ADD COLUMN "status" "ArtifactStatus" NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN "hardwareModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "minBatteryPercent" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "createdById" UUID,
ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "ConfigVersion"
ADD COLUMN "approvalStatus" "ConfigApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "createdById" UUID,
ADD COLUMN "approvedById" UUID,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rollbackVersionId" UUID;

ALTER TABLE "OTAJob"
ADD COLUMN "campaignId" UUID,
ADD COLUMN "commandId" UUID,
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "targetChecksum" TEXT,
ADD COLUMN "previousVersion" TEXT,
ADD COLUMN "rollbackVersion" TEXT,
ADD COLUMN "installStartedAt" TIMESTAMP(3),
ADD COLUMN "validatedAt" TIMESTAMP(3),
ADD COLUMN "lastEventAt" TIMESTAMP(3),
ADD COLUMN "rollbackReason" TEXT;

CREATE TABLE "OtaCampaign" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "softwareVersionId" UUID,
  "configVersionId" UUID,
  "strategy" "OtaRolloutStrategy" NOT NULL,
  "percentage" INTEGER,
  "requestedRobotIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "status" "OtaCampaignStatus" NOT NULL DEFAULT 'READY',
  "reason" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "targetCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "blockedCount" INTEGER NOT NULL DEFAULT 0,
  "blockedTargets" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "rollbackOfId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OtaCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OTAEvent" (
  "id" UUID NOT NULL,
  "otaJobId" UUID NOT NULL,
  "status" "OtaStatus" NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "source" "OtaEventSource" NOT NULL,
  "messageId" TEXT,
  "reasonCode" TEXT,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OTAEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConfigApproval" (
  "id" UUID NOT NULL,
  "configVersionId" UUID NOT NULL,
  "approverId" UUID NOT NULL,
  "decision" "ConfigApprovalDecision" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OTAJob_commandId_key" ON "OTAJob"("commandId");
CREATE INDEX "OTAJob_campaignId_status_idx" ON "OTAJob"("campaignId", "status");
CREATE INDEX "OtaCampaign_tenantId_projectId_createdAt_idx" ON "OtaCampaign"("tenantId", "projectId", "createdAt");
CREATE INDEX "OtaCampaign_softwareVersionId_status_idx" ON "OtaCampaign"("softwareVersionId", "status");
CREATE INDEX "OtaCampaign_configVersionId_status_idx" ON "OtaCampaign"("configVersionId", "status");
CREATE UNIQUE INDEX "OTAEvent_otaJobId_messageId_key" ON "OTAEvent"("otaJobId", "messageId");
CREATE INDEX "OTAEvent_otaJobId_occurredAt_idx" ON "OTAEvent"("otaJobId", "occurredAt");
CREATE UNIQUE INDEX "ConfigApproval_configVersionId_approverId_key" ON "ConfigApproval"("configVersionId", "approverId");
CREATE INDEX "ConfigApproval_configVersionId_createdAt_idx" ON "ConfigApproval"("configVersionId", "createdAt");

ALTER TABLE "OtaCampaign" ADD CONSTRAINT "OtaCampaign_softwareVersionId_fkey" FOREIGN KEY ("softwareVersionId") REFERENCES "SoftwareVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OtaCampaign" ADD CONSTRAINT "OtaCampaign_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OTAJob" ADD CONSTRAINT "OTAJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "OtaCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OTAEvent" ADD CONSTRAINT "OTAEvent_otaJobId_fkey" FOREIGN KEY ("otaJobId") REFERENCES "OTAJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConfigApproval" ADD CONSTRAINT "ConfigApproval_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
