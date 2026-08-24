-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RobotOnlineStatus" AS ENUM ('ONLINE', 'UNSTABLE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "RobotOperationalState" AS ENUM ('OFFLINE', 'BOOTING', 'IDLE', 'READY', 'DISPATCHING', 'RUNNING', 'PAUSED', 'BLOCKED', 'RETURNING', 'CHARGING', 'MAINTENANCE', 'FAULT', 'UPGRADING');

-- CreateEnum
CREATE TYPE "ChargingState" AS ENUM ('UNKNOWN', 'NOT_CHARGING', 'CHARGING', 'FULL');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('MISSION_START', 'MISSION_PAUSE', 'MISSION_RESUME', 'MISSION_CANCEL', 'RETURN_TO_CHARGE', 'RETURN_TO_STANDBY', 'CONFIG_APPLY', 'SOFTWARE_UPDATE');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('CREATED', 'SENT', 'ACCEPTED', 'EXECUTING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'DISPATCHING', 'ACCEPTED', 'RUNNING', 'PAUSED', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MapVersionStatus" AS ENUM ('DRAFT', 'VALIDATING', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('CLEANING', 'KEEP_OUT', 'SPEED_LIMIT', 'NO_CLEAN', 'CHARGING', 'STANDBY');

-- CreateEnum
CREATE TYPE "FaultSeverity" AS ENUM ('INFO', 'WARNING', 'STOP', 'LATCHED');

-- CreateEnum
CREATE TYPE "FaultHandlingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'HANDLED');

-- CreateEnum
CREATE TYPE "OtaStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'VERIFYING', 'INSTALLING', 'REBOOTING', 'VALIDATING', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "SoftwareComponent" AS ENUM ('ROBOT_APPLICATION', 'ROBOT_AGENT', 'ROS_PACKAGE', 'MCU_FIRMWARE', 'CONFIG');

-- CreateEnum
CREATE TYPE "ConfigCategory" AS ENUM ('BUSINESS', 'CLEANING', 'NAVIGATION', 'SAFETY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'TENANT_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'PROJECT_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'MAINTENANCE_ENGINEER';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "afterValue" JSONB,
ADD COLUMN     "beforeValue" JSONB,
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "Dataset" ADD COLUMN     "projectId" UUID,
ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "projectId" UUID,
ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "Robot" ADD COLUMN     "batteryPercent" INTEGER,
ADD COLUMN     "chargingState" "ChargingState" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "configVersion" TEXT,
ADD COLUMN     "currentMapId" UUID,
ADD COLUMN     "currentMapVersion" TEXT,
ADD COLUMN     "currentTaskId" UUID,
ADD COLUMN     "floorId" UUID,
ADD COLUMN     "lastOnlineAt" TIMESTAMP(3),
ADD COLUMN     "lastStateSequence" BIGINT,
ADD COLUMN     "lastTelemetryAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleStatus" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "localizationStatus" TEXT,
ADD COLUMN     "mcuVersion" TEXT,
ADD COLUMN     "onlineStatus" "RobotOnlineStatus" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN     "operationalState" "RobotOperationalState" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN     "projectId" UUID,
ADD COLUMN     "safetyCode" TEXT,
ADD COLUMN     "siteId" UUID,
ADD COLUMN     "softwareVersion" TEXT,
ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "tenantId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" UUID;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleDefinition" (
    "code" "UserRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Permission" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleCode" "UserRole" NOT NULL,
    "permissionCode" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleCode","permissionCode")
);

-- CreateTable
CREATE TABLE "UserProjectAccess" (
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProjectAccess_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "MissionTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "missionTemplateId" UUID,
    "mapVersionId" UUID NOT NULL,
    "zoneId" UUID,
    "name" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "currentProgress" DECIMAL(5,2),
    "lastStatusSource" TEXT,
    "lastStatusAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskRun" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "result" TEXT,
    "failureReason" TEXT,
    "plannedArea" DECIMAL(14,3),
    "cleanedArea" DECIMAL(14,3),
    "plannedDistance" DECIMAL(14,3),
    "actualDistance" DECIMAL(14,3),
    "runDurationMs" BIGINT,
    "pauseDurationMs" BIGINT,
    "blockedDurationMs" BIGINT,
    "batteryStart" INTEGER,
    "batteryEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "messageId" TEXT,
    "deviceTimestamp" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "taskId" UUID,
    "type" "CommandType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT,
    "createdById" UUID NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" UUID NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "messageId" TEXT NOT NULL,
    "sequence" BIGINT,
    "type" TEXT NOT NULL,
    "deviceTimestamp" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetrySample" (
    "id" BIGSERIAL NOT NULL,
    "robotId" UUID NOT NULL,
    "messageId" TEXT,
    "deviceTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" BIGINT,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "yaw" DOUBLE PRECISION,
    "linearVelocity" DOUBLE PRECISION,
    "angularVelocity" DOUBLE PRECISION,
    "battery" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "gpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "socTemperature" DOUBLE PRECISION,
    "network" JSONB,
    "taskProgress" DOUBLE PRECISION,
    "payload" JSONB,

    CONSTRAINT "TelemetrySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotHealthSnapshot" (
    "id" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "deviceTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resources" JSONB NOT NULL,
    "sensors" JSONB NOT NULL,

    CONSTRAINT "RobotHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyPolicy" (
    "code" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "severity" "FaultSeverity" NOT NULL,
    "latched" BOOLEAN NOT NULL,
    "fullBlock" BOOLEAN NOT NULL,
    "requiresOnsiteHandling" BOOLEAN NOT NULL,
    "allowAutoRecovery" BOOLEAN NOT NULL DEFAULT false,
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "handlingSuggestion" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyPolicy_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SafetyState" (
    "id" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "latched" BOOLEAN NOT NULL,
    "fullBlock" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "clearedAt" TIMESTAMP(3),
    "taskId" UUID,
    "position" JSONB,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB,

    CONSTRAINT "SafetyState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaultEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "taskId" UUID,
    "safeCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" "FaultSeverity" NOT NULL,
    "latched" BOOLEAN NOT NULL,
    "fullBlock" BOOLEAN NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "details" JSONB,
    "handlingStatus" "FaultHandlingStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedById" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "handledById" UUID,
    "handledAt" TIMESTAMP(3),
    "handlingRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaultEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "operatorId" UUID NOT NULL,
    "onsiteConfirmedById" UUID,
    "safeCodes" TEXT[],
    "handling" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMap" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "floorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapVersion" (
    "id" UUID NOT NULL,
    "mapId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "floorId" UUID NOT NULL,
    "mapObjectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "MapVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "validation" JSONB,
    "createdById" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" UUID NOT NULL,
    "mapVersionId" UUID NOT NULL,
    "type" "ZoneType" NOT NULL,
    "name" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareVersion" (
    "id" UUID NOT NULL,
    "component" "SoftwareComponent" NOT NULL,
    "version" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "signature" TEXT,
    "compatibility" JSONB,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoftwareVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID,
    "category" "ConfigCategory" NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTAJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "softwareVersionId" UUID,
    "configVersionId" UUID,
    "status" "OtaStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "rollbackStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OTAJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticBundle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "robotId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Project_tenantId_status_idx" ON "Project"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_code_key" ON "Project"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Site_tenantId_projectId_status_idx" ON "Site"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Site_projectId_code_key" ON "Site"("projectId", "code");

-- CreateIndex
CREATE INDEX "Floor_tenantId_projectId_status_idx" ON "Floor"("tenantId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_siteId_code_key" ON "Floor"("siteId", "code");

-- CreateIndex
CREATE INDEX "UserProjectAccess_projectId_idx" ON "UserProjectAccess"("projectId");

-- CreateIndex
CREATE INDEX "MissionTemplate_tenantId_projectId_status_idx" ON "MissionTemplate"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_projectId_status_scheduledAt_idx" ON "Task"("tenantId", "projectId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Task_robotId_status_idx" ON "Task"("robotId", "status");

-- CreateIndex
CREATE INDEX "TaskRun_taskId_startedAt_idx" ON "TaskRun"("taskId", "startedAt");

-- CreateIndex
CREATE INDEX "TaskRun_robotId_startedAt_idx" ON "TaskRun"("robotId", "startedAt");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_receivedAt_idx" ON "TaskEvent"("taskId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskEvent_taskId_messageId_key" ON "TaskEvent"("taskId", "messageId");

-- CreateIndex
CREATE INDEX "Command_robotId_status_createdAt_idx" ON "Command"("robotId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Command_taskId_createdAt_idx" ON "Command"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Command_createdById_idempotencyKey_key" ON "Command"("createdById", "idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_publishedAt_availableAt_idx" ON "OutboxMessage"("publishedAt", "availableAt");

-- CreateIndex
CREATE INDEX "InboxMessage_robotId_sequence_idx" ON "InboxMessage"("robotId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_robotId_messageId_key" ON "InboxMessage"("robotId", "messageId");

-- CreateIndex
CREATE INDEX "TelemetrySample_robotId_deviceTimestamp_idx" ON "TelemetrySample"("robotId", "deviceTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TelemetrySample_robotId_messageId_key" ON "TelemetrySample"("robotId", "messageId");

-- CreateIndex
CREATE INDEX "RobotHealthSnapshot_robotId_deviceTimestamp_idx" ON "RobotHealthSnapshot"("robotId", "deviceTimestamp");

-- CreateIndex
CREATE INDEX "SafetyState_robotId_active_occurredAt_idx" ON "SafetyState"("robotId", "active", "occurredAt");

-- CreateIndex
CREATE INDEX "FaultEvent_tenantId_projectId_handlingStatus_startAt_idx" ON "FaultEvent"("tenantId", "projectId", "handlingStatus", "startAt");

-- CreateIndex
CREATE INDEX "FaultEvent_robotId_startAt_idx" ON "FaultEvent"("robotId", "startAt");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_tenantId_projectId_robotId_enteredAt_idx" ON "MaintenanceRecord"("tenantId", "projectId", "robotId", "enteredAt");

-- CreateIndex
CREATE INDEX "PlatformMap_tenantId_projectId_floorId_idx" ON "PlatformMap"("tenantId", "projectId", "floorId");

-- CreateIndex
CREATE INDEX "MapVersion_floorId_status_idx" ON "MapVersion"("floorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MapVersion_mapId_version_key" ON "MapVersion"("mapId", "version");

-- CreateIndex
CREATE INDEX "Zone_mapVersionId_type_idx" ON "Zone"("mapVersionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareVersion_component_version_key" ON "SoftwareVersion"("component", "version");

-- CreateIndex
CREATE INDEX "ConfigVersion_tenantId_projectId_category_idx" ON "ConfigVersion"("tenantId", "projectId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_tenantId_category_version_key" ON "ConfigVersion"("tenantId", "category", "version");

-- CreateIndex
CREATE INDEX "OTAJob_tenantId_projectId_robotId_status_idx" ON "OTAJob"("tenantId", "projectId", "robotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticBundle_objectKey_key" ON "DiagnosticBundle"("objectKey");

-- CreateIndex
CREATE INDEX "DiagnosticBundle_tenantId_projectId_robotId_createdAt_idx" ON "DiagnosticBundle"("tenantId", "projectId", "robotId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_pushToken_key" ON "PushDevice"("pushToken");

-- CreateIndex
CREATE INDEX "PushDevice_userId_lastSeenAt_idx" ON "PushDevice"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Robot_tenantId_projectId_onlineStatus_idx" ON "Robot"("tenantId", "projectId", "onlineStatus");

-- CreateIndex
CREATE INDEX "Robot_floorId_operationalState_idx" ON "Robot"("floorId", "operationalState");

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Robot" ADD CONSTRAINT "Robot_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "RoleDefinition"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "Permission"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionTemplate" ADD CONSTRAINT "MissionTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_missionTemplateId_fkey" FOREIGN KEY ("missionTemplateId") REFERENCES "MissionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mapVersionId_fkey" FOREIGN KEY ("mapVersionId") REFERENCES "MapVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskRun" ADD CONSTRAINT "TaskRun_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetrySample" ADD CONSTRAINT "TelemetrySample_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RobotHealthSnapshot" ADD CONSTRAINT "RobotHealthSnapshot_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyState" ADD CONSTRAINT "SafetyState_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultEvent" ADD CONSTRAINT "FaultEvent_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultEvent" ADD CONSTRAINT "FaultEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultEvent" ADD CONSTRAINT "FaultEvent_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultEvent" ADD CONSTRAINT "FaultEvent_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_onsiteConfirmedById_fkey" FOREIGN KEY ("onsiteConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMap" ADD CONSTRAINT "PlatformMap_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMap" ADD CONSTRAINT "PlatformMap_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapVersion" ADD CONSTRAINT "MapVersion_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "PlatformMap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MapVersion" ADD CONSTRAINT "MapVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_mapVersionId_fkey" FOREIGN KEY ("mapVersionId") REFERENCES "MapVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTAJob" ADD CONSTRAINT "OTAJob_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTAJob" ADD CONSTRAINT "OTAJob_softwareVersionId_fkey" FOREIGN KEY ("softwareVersionId") REFERENCES "SoftwareVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTAJob" ADD CONSTRAINT "OTAJob_configVersionId_fkey" FOREIGN KEY ("configVersionId") REFERENCES "ConfigVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticBundle" ADD CONSTRAINT "DiagnosticBundle_robotId_fkey" FOREIGN KEY ("robotId") REFERENCES "Robot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve all pre-platform records by attaching them to a deterministic
-- compatibility hierarchy. New APIs never silently select this hierarchy;
-- it exists only so the existing data-management domain remains usable.
INSERT INTO "Tenant" ("id", "code", "name", "status", "createdAt", "updatedAt")
VALUES ('11111111-1111-4111-8111-111111111111', 'LEGACY', 'Legacy Data Platform', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Project" ("id", "tenantId", "code", "name", "status", "createdAt", "updatedAt")
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'LEGACY-DATA', 'Legacy Data Project', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "code") DO NOTHING;

INSERT INTO "Site" ("id", "tenantId", "projectId", "code", "name", "status", "createdAt", "updatedAt")
VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'LEGACY-SITE', 'Legacy Site', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("projectId", "code") DO NOTHING;

INSERT INTO "Floor" ("id", "tenantId", "projectId", "siteId", "code", "name", "level", "status", "createdAt", "updatedAt")
VALUES ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'LEGACY-FLOOR-1', 'Legacy Floor 1', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("siteId", "code") DO NOTHING;

UPDATE "Robot" SET
  "tenantId" = COALESCE("tenantId", '11111111-1111-4111-8111-111111111111'),
  "projectId" = COALESCE("projectId", '22222222-2222-4222-8222-222222222222'),
  "siteId" = COALESCE("siteId", '33333333-3333-4333-8333-333333333333'),
  "floorId" = COALESCE("floorId", '44444444-4444-4444-8444-444444444444');

UPDATE "Dataset" SET
  "tenantId" = COALESCE("tenantId", '11111111-1111-4111-8111-111111111111'),
  "projectId" = COALESCE("projectId", '22222222-2222-4222-8222-222222222222');

UPDATE "Tag" SET "tenantId" = COALESCE("tenantId", '11111111-1111-4111-8111-111111111111');
UPDATE "User" SET "tenantId" = '11111111-1111-4111-8111-111111111111' WHERE "role" IN ('OPERATOR', 'VIEWER') AND "tenantId" IS NULL;

INSERT INTO "UserProjectAccess" ("userId", "projectId", "createdAt")
SELECT "id", '22222222-2222-4222-8222-222222222222', CURRENT_TIMESTAMP
FROM "User"
WHERE "role" IN ('OPERATOR', 'VIEWER')
ON CONFLICT ("userId", "projectId") DO NOTHING;

ALTER TABLE "Robot" ADD CONSTRAINT "Robot_batteryPercent_check" CHECK ("batteryPercent" IS NULL OR ("batteryPercent" >= 0 AND "batteryPercent" <= 100));
