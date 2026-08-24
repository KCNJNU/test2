import { Injectable } from '@nestjs/common';
import { ChargingState, CommandStatus, FaultSeverity, OtaCampaignStatus, OtaEventSource, OtaStatus, Prisma, RobotOperationalState, SoftwareComponent, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceProtocolError, ParsedDeviceMessage, ProcessResult } from './protocol.types';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class InboundMessageService {
  constructor(private readonly prisma: PrismaService) {}

  async process(message: ParsedDeviceMessage): Promise<ProcessResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { envelope } = message;
        const robot = await tx.robot.findUnique({ where: { id: envelope.robotId } });
        if (!robot) throw new DeviceProtocolError('DEVICE_NOT_REGISTERED', 'Robot is not registered');
        if (!robot.externalId || robot.externalId !== envelope.robotSn) throw new DeviceProtocolError('DEVICE_IDENTITY_MISMATCH', 'robotSn does not match the registered robot');
        await tx.inboxMessage.create({ data: {
          robotId: envelope.robotId,
          messageId: envelope.messageId,
          sequence: envelope.sequence,
          type: envelope.type,
          deviceTimestamp: envelope.deviceTimestamp,
          payload: envelope.payload as Prisma.InputJsonValue,
        } });
        const fresh = robot.lastStateSequence === null || envelope.sequence > robot.lastStateSequence;
        if (message.channel === 'heartbeat') await this.applyHeartbeat(tx, message, fresh);
        else if (message.channel === 'telemetry') await this.applyTelemetry(tx, message, fresh);
        else if (message.channel === 'events') await this.applyEvent(tx, message, fresh);
        else if (message.channel === 'faults') await this.applyFault(tx, message, fresh, robot.tenantId, robot.projectId);
        else await this.applyCommandAck(tx, message);
        return { status: fresh ? 'processed' : 'stale', messageId: envelope.messageId };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { status: 'duplicate', messageId: message.envelope.messageId };
      }
      throw error;
    }
  }

  private async applyHeartbeat(tx: Transaction, message: ParsedDeviceMessage, fresh: boolean) {
    const { envelope } = message;
    const data: Prisma.RobotUncheckedUpdateInput = { onlineStatus: 'ONLINE', lastOnlineAt: new Date() };
    if (fresh) {
      data.lastStateSequence = envelope.sequence;
      const state = enumValue(RobotOperationalState, envelope.payload.state);
      const charging = enumValue(ChargingState, envelope.payload.chargingState);
      const battery = integer(envelope.payload.batteryPercent, 0, 100);
      if (state) data.operationalState = state;
      if (charging) data.chargingState = charging;
      if (battery !== undefined) data.batteryPercent = battery;
      assignString(data, 'softwareVersion', envelope.payload.softwareVersion);
      assignString(data, 'mcuVersion', envelope.payload.mcuVersion);
      assignString(data, 'configVersion', envelope.payload.configVersion);
      assignString(data, 'currentMapVersion', envelope.payload.currentMapVersion);
      assignString(data, 'localizationStatus', envelope.payload.localizationStatus);
    }
    await tx.robot.update({ where: { id: envelope.robotId }, data });
  }

  private async applyTelemetry(tx: Transaction, message: ParsedDeviceMessage, fresh: boolean) {
    const { envelope } = message;
    const payload = envelope.payload;
    await tx.telemetrySample.create({ data: {
      robotId: envelope.robotId,
      messageId: envelope.messageId,
      sequence: envelope.sequence,
      deviceTimestamp: envelope.deviceTimestamp,
      receivedAt: new Date(),
      positionX: number(payload.positionX), positionY: number(payload.positionY), yaw: number(payload.yaw),
      linearVelocity: number(payload.linearVelocity), angularVelocity: number(payload.angularVelocity), battery: number(payload.battery),
      cpuUsage: number(payload.cpuUsage), gpuUsage: number(payload.gpuUsage), memoryUsage: number(payload.memoryUsage),
      socTemperature: number(payload.socTemperature), taskProgress: number(payload.taskProgress),
      network: json(payload.network), payload: payload as Prisma.InputJsonValue,
    } });
    const data: Prisma.RobotUncheckedUpdateInput = { lastTelemetryAt: new Date() };
    if (fresh) {
      data.lastStateSequence = envelope.sequence;
      const battery = integer(payload.battery, 0, 100);
      const state = enumValue(RobotOperationalState, payload.state);
      if (battery !== undefined) data.batteryPercent = battery;
      if (state) data.operationalState = state;
    }
    await tx.robot.update({ where: { id: envelope.robotId }, data });
  }

  private async applyEvent(tx: Transaction, message: ParsedDeviceMessage, fresh: boolean) {
    const { envelope } = message;
    if (envelope.type === 'ota_status') {
      await this.applyOtaStatus(tx, message, fresh);
      return;
    }
    if (envelope.type === 'task_event') {
      const taskId = requiredString(envelope.payload.taskId, 'INVALID_TASK_EVENT');
      const status = enumValue(TaskStatus, envelope.payload.status);
      if (!status) throw new DeviceProtocolError('INVALID_TASK_EVENT', 'Task status is invalid');
      const task = await tx.task.findFirst({ where: { id: taskId, robotId: envelope.robotId } });
      if (!task) throw new DeviceProtocolError('TASK_OWNERSHIP_MISMATCH', 'Task does not belong to the robot');
      if (fresh && !taskTransitionAllowed(task.status, status)) {
        throw new DeviceProtocolError('INVALID_TASK_TRANSITION', `Task cannot transition from ${task.status} to ${status}`);
      }
      await tx.taskEvent.create({ data: {
        taskId, fromStatus: task.status, toStatus: status, source: 'ROBOT_AGENT',
        reason: optionalString(envelope.payload.reason), messageId: envelope.messageId,
        deviceTimestamp: envelope.deviceTimestamp, details: envelope.payload as Prisma.InputJsonValue,
      } });
      if (fresh) {
        await tx.task.update({ where: { id: taskId }, data: { status, lastStatusSource: 'ROBOT_AGENT', lastStatusAt: new Date() } });
        await tx.robot.update({ where: { id: envelope.robotId }, data: {
          lastStateSequence: envelope.sequence,
          operationalState: robotStateForTask(status),
          currentTaskId: terminalTask(status) ? null : taskId,
        } });
      }
      return;
    }
    if (!fresh) return;
    const state = envelope.type === 'maintenance_event'
      ? (envelope.payload.active === false ? RobotOperationalState.READY : RobotOperationalState.MAINTENANCE)
      : enumValue(RobotOperationalState, envelope.payload.state);
    if (!state) throw new DeviceProtocolError('INVALID_ROBOT_STATE', 'Robot state event is invalid');
    await tx.robot.update({ where: { id: envelope.robotId }, data: { operationalState: state, lastStateSequence: envelope.sequence } });
  }

  private async applyOtaStatus(tx: Transaction, message: ParsedDeviceMessage, fresh: boolean) {
    const { envelope } = message;
    const otaJobId = requiredString(envelope.payload.otaJobId, 'INVALID_OTA_EVENT');
    const status = enumValue(OtaStatus, envelope.payload.status);
    const progress = integer(envelope.payload.progress, 0, 100) ?? progressForOtaStatus(status);
    if (!status) throw new DeviceProtocolError('INVALID_OTA_EVENT', 'OTA status is invalid');
    const job = await tx.oTAJob.findFirst({
      where: { id: otaJobId, robotId: envelope.robotId },
      include: { softwareVersion: true, configVersion: true },
    });
    if (!job) throw new DeviceProtocolError('OTA_OWNERSHIP_MISMATCH', 'OTA job does not belong to the robot');
    if (!otaTransitionAllowed(job.status, status)) {
      throw new DeviceProtocolError('INVALID_OTA_TRANSITION', 'OTA state transition is not allowed');
    }

    const now = new Date();
    const reasonCode = optionalString(envelope.payload.reasonCode) ?? optionalString(envelope.payload.failureCode);
    await tx.oTAEvent.create({ data: {
      otaJobId, status, progress, source: OtaEventSource.ROBOT_AGENT, messageId: envelope.messageId,
      reasonCode, details: envelope.payload as Prisma.InputJsonValue, occurredAt: envelope.deviceTimestamp,
    } });
    await tx.oTAJob.update({ where: { id: otaJobId }, data: {
      status, progress, lastEventAt: now,
      startedAt: status === OtaStatus.DOWNLOADING && !job.startedAt ? now : job.startedAt,
      installStartedAt: status === OtaStatus.INSTALLING && !job.installStartedAt ? now : job.installStartedAt,
      validatedAt: status === OtaStatus.VALIDATING ? now : job.validatedAt,
      finishedAt: TERMINAL_OTA_STATUSES.has(status) ? now : job.finishedAt,
      failureReason: status === OtaStatus.FAILED ? (reasonCode ?? 'OTA_FAILED') : job.failureReason,
      rollbackStatus: status === OtaStatus.ROLLED_BACK ? 'SUCCEEDED' : job.rollbackStatus,
      rollbackReason: status === OtaStatus.ROLLED_BACK ? (reasonCode ?? job.failureReason ?? 'AUTOMATIC_ROLLBACK') : job.rollbackReason,
    } });

    if (fresh) {
      const robotData: Prisma.RobotUncheckedUpdateInput = { lastStateSequence: envelope.sequence };
      if (ACTIVE_OTA_STATUSES.has(status)) robotData.operationalState = RobotOperationalState.UPGRADING;
      if (status === OtaStatus.FAILED) robotData.operationalState = RobotOperationalState.MAINTENANCE;
      if (status === OtaStatus.SUCCEEDED || status === OtaStatus.ROLLED_BACK) {
        robotData.operationalState = RobotOperationalState.READY;
        assignOtaVersion(robotData, job, status === OtaStatus.ROLLED_BACK);
      }
      await tx.robot.update({ where: { id: envelope.robotId }, data: robotData });
    }
    if (job.commandId) {
      const commandStatus = status === OtaStatus.SUCCEEDED ? CommandStatus.SUCCEEDED
        : status === OtaStatus.FAILED || status === OtaStatus.ROLLED_BACK ? CommandStatus.FAILED
          : CommandStatus.EXECUTING;
      await tx.command.updateMany({ where: { id: job.commandId, status: { notIn: [...TERMINAL_COMMAND_STATUSES] } }, data: {
        status: commandStatus,
        finishedAt: TERMINAL_OTA_STATUSES.has(status) ? now : undefined,
        failureCode: status === OtaStatus.FAILED || status === OtaStatus.ROLLED_BACK ? reasonCode ?? 'OTA_FAILED' : undefined,
      } });
    }
    if (job.campaignId) await this.refreshCampaign(tx, job.campaignId, now);
  }

  private async refreshCampaign(tx: Transaction, campaignId: string, now: Date) {
    const jobs = await tx.oTAJob.findMany({ where: { campaignId }, select: { status: true } });
    if (!jobs.length || jobs.some((job) => !TERMINAL_OTA_STATUSES.has(job.status))) return;
    const succeeded = jobs.filter((job) => job.status === OtaStatus.SUCCEEDED).length;
    const rolledBack = jobs.filter((job) => job.status === OtaStatus.ROLLED_BACK).length;
    const status = succeeded === jobs.length ? OtaCampaignStatus.SUCCEEDED
      : rolledBack === jobs.length ? OtaCampaignStatus.ROLLED_BACK
        : succeeded > 0 ? OtaCampaignStatus.PARTIALLY_FAILED : OtaCampaignStatus.FAILED;
    await tx.otaCampaign.update({ where: { id: campaignId }, data: { status, finishedAt: now } });
  }

  private async applyFault(tx: Transaction, message: ParsedDeviceMessage, fresh: boolean, tenantId: string | null, projectId: string | null) {
    const { envelope } = message;
    if (!tenantId || !projectId) throw new DeviceProtocolError('ROBOT_SCOPE_REQUIRED', 'Robot must be assigned to a tenant and project');
    const safeCode = requiredString(envelope.payload.safeCode, 'INVALID_FAULT_EVENT');
    const policy = await tx.safetyPolicy.findUnique({ where: { code: safeCode } });
    const latched = policy?.latched ?? true;
    const fullBlock = policy?.fullBlock ?? true;
    const severity = policy?.severity ?? FaultSeverity.LATCHED;
    const occurredAt = timestampOr(envelope.payload.occurredAt, envelope.deviceTimestamp);
    const taskId = optionalString(envelope.payload.taskId);
    if (taskId && !await tx.task.findFirst({ where: { id: taskId, robotId: envelope.robotId } })) {
      throw new DeviceProtocolError('TASK_OWNERSHIP_MISMATCH', 'Fault task does not belong to the robot');
    }
    await tx.safetyState.create({ data: {
      robotId: envelope.robotId, code: safeCode, active: true, latched, fullBlock, source: 'ROBOT_AGENT',
      message: policy?.meaning ?? `Unconfigured SAFE code ${safeCode}`, occurredAt, taskId,
      position: json(envelope.payload.position), details: envelope.payload as Prisma.InputJsonValue,
    } });
    await tx.faultEvent.create({ data: {
      tenantId, projectId, robotId: envelope.robotId, taskId, safeCode, source: 'ROBOT_AGENT', severity, latched, fullBlock,
      startAt: occurredAt, positionX: number(envelope.payload.positionX), positionY: number(envelope.payload.positionY),
      details: envelope.payload as Prisma.InputJsonValue,
    } });
    if (fresh) await tx.robot.update({ where: { id: envelope.robotId }, data: {
      safetyCode: safeCode, operationalState: fullBlock ? RobotOperationalState.BLOCKED : RobotOperationalState.FAULT,
      lastStateSequence: envelope.sequence,
    } });
  }

  private async applyCommandAck(tx: Transaction, message: ParsedDeviceMessage) {
    const { envelope } = message;
    const commandId = requiredString(envelope.payload.commandId, 'INVALID_COMMAND_ACK');
    const status = enumValue(CommandStatus, envelope.payload.status);
    if (!status || !ACK_STATUSES.has(status)) throw new DeviceProtocolError('INVALID_COMMAND_ACK', 'Command ACK status is invalid');
    const command = await tx.command.findFirst({ where: { id: commandId, robotId: envelope.robotId } });
    if (!command) throw new DeviceProtocolError('COMMAND_OWNERSHIP_MISMATCH', 'Command does not belong to the robot');
    if (!commandTransitionAllowed(command.status, status)) return;
    const now = new Date();
    await tx.command.update({ where: { id: commandId }, data: {
      status,
      acceptedAt: status === CommandStatus.ACCEPTED ? now : command.acceptedAt,
      finishedAt: TERMINAL_ACK_STATUSES.has(status) ? now : command.finishedAt,
      failureCode: optionalString(envelope.payload.failureCode),
      failureMessage: optionalString(envelope.payload.failureMessage),
    } });
    if (status === CommandStatus.ACCEPTED && command.taskId) {
      const task = await tx.task.findUnique({ where: { id: command.taskId } });
      if (task?.status === TaskStatus.DISPATCHING) {
        await tx.task.update({ where: { id: task.id }, data: { status: TaskStatus.ACCEPTED, lastStatusSource: 'ROBOT_AGENT', lastStatusAt: now } });
        await tx.taskEvent.create({ data: {
          taskId: task.id, fromStatus: task.status, toStatus: TaskStatus.ACCEPTED, source: 'ROBOT_AGENT',
          messageId: envelope.messageId, deviceTimestamp: envelope.deviceTimestamp, details: envelope.payload as Prisma.InputJsonValue,
        } });
      }
    }
  }
}

const ACK_STATUSES: ReadonlySet<CommandStatus> = new Set<CommandStatus>([CommandStatus.ACCEPTED, CommandStatus.EXECUTING, CommandStatus.SUCCEEDED, CommandStatus.REJECTED, CommandStatus.FAILED]);
const TERMINAL_ACK_STATUSES: ReadonlySet<CommandStatus> = new Set<CommandStatus>([CommandStatus.SUCCEEDED, CommandStatus.REJECTED, CommandStatus.FAILED]);
const TERMINAL_COMMAND_STATUSES: ReadonlySet<CommandStatus> = new Set<CommandStatus>([...TERMINAL_ACK_STATUSES, CommandStatus.TIMEOUT]);
const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELED]);
const ACTIVE_OTA_STATUSES: ReadonlySet<OtaStatus> = new Set([OtaStatus.DOWNLOADING, OtaStatus.VERIFYING, OtaStatus.INSTALLING, OtaStatus.REBOOTING, OtaStatus.VALIDATING]);
const TERMINAL_OTA_STATUSES: ReadonlySet<OtaStatus> = new Set([OtaStatus.SUCCEEDED, OtaStatus.FAILED, OtaStatus.ROLLED_BACK]);

function enumValue<T extends string>(values: Record<string, T>, value: unknown): T | undefined {
  return typeof value === 'string' && Object.values(values).includes(value as T) ? value as T : undefined;
}
function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function integer(value: unknown, minimum: number, maximum: number) { const parsed = number(value); return parsed === undefined ? undefined : Math.max(minimum, Math.min(maximum, Math.round(parsed))); }
function optionalString(value: unknown) { return typeof value === 'string' && value.length ? value : undefined; }
function requiredString(value: unknown, code: string) { const parsed = optionalString(value); if (!parsed) throw new DeviceProtocolError(code, 'Required string is missing'); return parsed; }
function json(value: unknown): Prisma.InputJsonValue | undefined { return value === undefined ? undefined : value as Prisma.InputJsonValue; }
function timestampOr(value: unknown, fallback: Date) { const parsed = typeof value === 'string' || typeof value === 'number' ? new Date(value) : fallback; return Number.isNaN(parsed.getTime()) ? fallback : parsed; }
function assignString(target: Prisma.RobotUncheckedUpdateInput, key: 'softwareVersion' | 'mcuVersion' | 'configVersion' | 'currentMapVersion' | 'localizationStatus', value: unknown) { const parsed = optionalString(value); if (parsed) target[key] = parsed; }
function terminalTask(status: TaskStatus) { return TERMINAL_TASK_STATUSES.has(status); }
function robotStateForTask(status: TaskStatus): RobotOperationalState {
  if (status === TaskStatus.RUNNING) return RobotOperationalState.RUNNING;
  if (status === TaskStatus.PAUSED) return RobotOperationalState.PAUSED;
  if (status === TaskStatus.BLOCKED) return RobotOperationalState.BLOCKED;
  if (status === TaskStatus.DISPATCHING || status === TaskStatus.ACCEPTED) return RobotOperationalState.DISPATCHING;
  return RobotOperationalState.READY;
}
function taskTransitionAllowed(from: TaskStatus, to: TaskStatus) {
  if (from === to) return true;
  const allowed: Partial<Record<TaskStatus, ReadonlySet<TaskStatus>>> = {
    [TaskStatus.DRAFT]: new Set([TaskStatus.SCHEDULED, TaskStatus.QUEUED, TaskStatus.DISPATCHING, TaskStatus.CANCELED]),
    [TaskStatus.SCHEDULED]: new Set([TaskStatus.QUEUED, TaskStatus.DISPATCHING, TaskStatus.CANCELED]),
    [TaskStatus.QUEUED]: new Set([TaskStatus.DISPATCHING, TaskStatus.CANCELED]),
    [TaskStatus.DISPATCHING]: new Set([TaskStatus.ACCEPTED, TaskStatus.FAILED, TaskStatus.CANCELED]),
    [TaskStatus.ACCEPTED]: new Set([TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELED]),
    [TaskStatus.RUNNING]: new Set([TaskStatus.PAUSED, TaskStatus.BLOCKED, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELED]),
    [TaskStatus.PAUSED]: new Set([TaskStatus.RUNNING, TaskStatus.BLOCKED, TaskStatus.FAILED, TaskStatus.CANCELED]),
    [TaskStatus.BLOCKED]: new Set([TaskStatus.RUNNING, TaskStatus.FAILED, TaskStatus.CANCELED]),
  };
  return allowed[from]?.has(to) ?? false;
}
function commandTransitionAllowed(from: CommandStatus, to: CommandStatus) {
  if (from === to) return true;
  const allowed: Partial<Record<CommandStatus, ReadonlySet<CommandStatus>>> = {
    [CommandStatus.SENT]: new Set([CommandStatus.ACCEPTED, CommandStatus.EXECUTING, CommandStatus.SUCCEEDED, CommandStatus.REJECTED, CommandStatus.FAILED]),
    [CommandStatus.ACCEPTED]: new Set([CommandStatus.EXECUTING, CommandStatus.SUCCEEDED, CommandStatus.REJECTED, CommandStatus.FAILED]),
    [CommandStatus.EXECUTING]: new Set([CommandStatus.SUCCEEDED, CommandStatus.FAILED]),
  };
  return allowed[from]?.has(to) ?? false;
}

function progressForOtaStatus(status: OtaStatus | undefined) {
  const defaults: Partial<Record<OtaStatus, number>> = {
    [OtaStatus.PENDING]: 0, [OtaStatus.DOWNLOADING]: 10, [OtaStatus.VERIFYING]: 35,
    [OtaStatus.INSTALLING]: 55, [OtaStatus.REBOOTING]: 75, [OtaStatus.VALIDATING]: 90,
    [OtaStatus.SUCCEEDED]: 100, [OtaStatus.ROLLED_BACK]: 100,
  };
  return status ? defaults[status] ?? 0 : 0;
}

function otaTransitionAllowed(from: OtaStatus, to: OtaStatus) {
  if (from === to) return true;
  const allowed: Partial<Record<OtaStatus, ReadonlySet<OtaStatus>>> = {
    [OtaStatus.PENDING]: new Set([OtaStatus.DOWNLOADING, OtaStatus.FAILED]),
    [OtaStatus.DOWNLOADING]: new Set([OtaStatus.VERIFYING, OtaStatus.FAILED]),
    [OtaStatus.VERIFYING]: new Set([OtaStatus.INSTALLING, OtaStatus.FAILED]),
    [OtaStatus.INSTALLING]: new Set([OtaStatus.REBOOTING, OtaStatus.FAILED, OtaStatus.ROLLED_BACK]),
    [OtaStatus.REBOOTING]: new Set([OtaStatus.VALIDATING, OtaStatus.FAILED, OtaStatus.ROLLED_BACK]),
    [OtaStatus.VALIDATING]: new Set([OtaStatus.SUCCEEDED, OtaStatus.FAILED, OtaStatus.ROLLED_BACK]),
    [OtaStatus.FAILED]: new Set([OtaStatus.ROLLED_BACK]),
  };
  return allowed[from]?.has(to) ?? false;
}

function assignOtaVersion(
  data: Prisma.RobotUncheckedUpdateInput,
  job: { previousVersion: string | null; softwareVersion: { version: string; component: SoftwareComponent } | null; configVersion: { version: string } | null },
  rollback: boolean,
) {
  const version = rollback ? job.previousVersion : job.softwareVersion?.version ?? job.configVersion?.version;
  if (!version) return;
  if (job.configVersion || job.softwareVersion?.component === SoftwareComponent.CONFIG) data.configVersion = version;
  else if (job.softwareVersion?.component === SoftwareComponent.MCU_FIRMWARE) data.mcuVersion = version;
  else data.softwareVersion = version;
}
