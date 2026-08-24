import { FaultSeverity, OtaStatus, Prisma, RobotOperationalState, SoftwareComponent, TaskStatus } from '@prisma/client';
import { InboundMessageService } from './inbound-message.service';
import type { ParsedDeviceMessage } from './protocol.types';

describe('InboundMessageService', () => {
  const robotId = '11111111-1111-4111-8111-111111111111';
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const projectId = '33333333-3333-4333-8333-333333333333';
  const tx = {
    robot: { findUnique: jest.fn(), update: jest.fn() }, inboxMessage: { create: jest.fn() }, telemetrySample: { create: jest.fn() },
    task: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() }, taskEvent: { create: jest.fn() },
    safetyPolicy: { findUnique: jest.fn() }, safetyState: { create: jest.fn() }, faultEvent: { create: jest.fn() },
    command: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    oTAJob: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() }, otaCampaign: { update: jest.fn() },
    oTAEvent: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
  const service = new InboundMessageService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.robot.findUnique.mockResolvedValue({ id: robotId, externalId: 'CR-001', tenantId, projectId, lastStateSequence: 4n });
    tx.inboxMessage.create.mockResolvedValue({}); tx.robot.update.mockResolvedValue({});
  });

  it('applies a fresh heartbeat and records its sequence', async () => {
    const result = await service.process(message('heartbeat', 'heartbeat', 5n, { state: 'READY', batteryPercent: 75 }));
    expect(result.status).toBe('processed');
    expect(tx.inboxMessage.create).toHaveBeenCalled();
    expect(tx.robot.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      onlineStatus: 'ONLINE', operationalState: 'READY', batteryPercent: 75, lastStateSequence: 5n,
    }) }));
  });

  it('retains a stale heartbeat without overwriting robot state', async () => {
    const result = await service.process(message('heartbeat', 'heartbeat', 3n, { state: 'RUNNING' }));
    expect(result.status).toBe('stale');
    expect(tx.robot.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
      onlineStatus: 'ONLINE', lastOnlineAt: expect.any(Date),
    } }));
  });

  it('deduplicates a repeated messageId through the Inbox unique key', async () => {
    tx.inboxMessage.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }));
    await expect(service.process(message('heartbeat', 'heartbeat', 5n, {}))).resolves.toEqual({ status: 'duplicate', messageId: 'MSG-5' });
  });

  it('fails closed for an unknown SAFE code', async () => {
    tx.safetyPolicy.findUnique.mockResolvedValue(null); tx.safetyState.create.mockResolvedValue({}); tx.faultEvent.create.mockResolvedValue({});
    await service.process(message('faults', 'fault_event', 6n, { safeCode: 'SAFE-999' }));
    expect(tx.safetyState.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ latched: true, fullBlock: true }) }));
    expect(tx.faultEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ severity: FaultSeverity.LATCHED }) }));
    expect(tx.robot.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationalState: RobotOperationalState.BLOCKED }) }));
  });

  it('applies a validated OTA success and records the installed version', async () => {
    tx.oTAJob.findFirst.mockResolvedValue({
      id: 'ota-1', status: OtaStatus.VALIDATING, startedAt: new Date(), installStartedAt: new Date(), validatedAt: new Date(),
      finishedAt: null, failureReason: null, rollbackStatus: null, rollbackReason: null, commandId: 'command-1', campaignId: null,
      previousVersion: '1.0.0', softwareVersion: { version: '1.1.0', component: SoftwareComponent.ROBOT_APPLICATION }, configVersion: null,
    });
    tx.oTAEvent.create.mockResolvedValue({}); tx.oTAJob.update.mockResolvedValue({}); tx.command.updateMany.mockResolvedValue({ count: 1 });
    await service.process(message('events', 'ota_status', 7n, { otaJobId: 'ota-1', status: 'SUCCEEDED', progress: 100 }));
    expect(tx.oTAEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED', source: 'ROBOT_AGENT' }) }));
    expect(tx.robot.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationalState: 'READY', softwareVersion: '1.1.0' }) }));
    expect(tx.command.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { notIn: expect.arrayContaining(['TIMEOUT']) } }) }));
  });

  it('marks checksum failure without entering installation', async () => {
    tx.oTAJob.findFirst.mockResolvedValue({
      id: 'ota-1', status: OtaStatus.VERIFYING, startedAt: new Date(), installStartedAt: null, validatedAt: null,
      finishedAt: null, failureReason: null, rollbackStatus: null, rollbackReason: null, commandId: null, campaignId: null,
      previousVersion: '1.0.0', softwareVersion: { version: '1.1.0', component: SoftwareComponent.ROBOT_APPLICATION }, configVersion: null,
    });
    tx.oTAEvent.create.mockResolvedValue({}); tx.oTAJob.update.mockResolvedValue({});
    await service.process(message('events', 'ota_status', 7n, { otaJobId: 'ota-1', status: 'FAILED', progress: 35, reasonCode: 'CHECKSUM_MISMATCH' }));
    expect(tx.oTAJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'FAILED', failureReason: 'CHECKSUM_MISMATCH', installStartedAt: null,
    }) }));
    expect(tx.robot.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operationalState: 'MAINTENANCE' }) }));
  });

  it('rejects an OTA event that skips checksum verification', async () => {
    tx.oTAJob.findFirst.mockResolvedValue({ id: 'ota-1', status: OtaStatus.DOWNLOADING });
    await expect(service.process(message('events', 'ota_status', 7n, { otaJobId: 'ota-1', status: 'INSTALLING' })))
      .rejects.toMatchObject({ code: 'INVALID_OTA_TRANSITION' });
    expect(tx.oTAEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a fresh robot event that regresses a terminal task state', async () => {
    tx.task.findFirst.mockResolvedValue({ id: 'task-1', robotId, status: TaskStatus.COMPLETED });

    await expect(service.process(message('events', 'task_event', 7n, { taskId: 'task-1', status: 'RUNNING' })))
      .rejects.toMatchObject({ code: 'INVALID_TASK_TRANSITION' });
    expect(tx.taskEvent.create).not.toHaveBeenCalled();
    expect(tx.task.update).not.toHaveBeenCalled();
  });

  function message(channel: ParsedDeviceMessage['channel'], type: string, sequence: bigint, payload: Record<string, unknown>): ParsedDeviceMessage {
    return { channel, topic: `robots/${robotId}/${channel}`, envelope: {
      schemaVersion: '1.0', messageId: `MSG-${sequence}`, robotId, robotSn: 'CR-001', timestamp: Date.now(), deviceTimestamp: new Date(), sequence, type, payload,
    } };
  }
});
