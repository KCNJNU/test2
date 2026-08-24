import { CommandStatus } from '@prisma/client';
import { OutboxPublisherService } from './outbox-publisher.service';

describe('OutboxPublisherService', () => {
  const robotId = '11111111-1111-4111-8111-111111111111';
  const commandId = '22222222-2222-4222-8222-222222222222';
  const tx = {
    $queryRaw: jest.fn(), outboxMessage: { update: jest.fn() }, command: { findUnique: jest.fn(), update: jest.fn() }, rolePermission: { findUnique: jest.fn() },
  };
  let transactionActive = false;
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
      transactionActive = true;
      try { return await callback(tx); } finally { transactionActive = false; }
    }),
    outboxMessage: { update: jest.fn() }, command: { updateMany: jest.fn() },
  };
  const client = { publishAsync: jest.fn() };
  const service = new OutboxPublisherService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    transactionActive = false;
    tx.$queryRaw.mockResolvedValue([{ id: 'outbox-1', aggregateId: commandId, topic: `robots/${robotId}/commands`, payload: { payload: {} }, attempts: 0 }]);
    tx.command.findUnique.mockResolvedValue({ id: commandId, robotId, type: 'MISSION_START', payload: {}, robot: { id: robotId, externalId: 'CR-001', tenantId: 'tenant-1' }, createdBy: { role: 'OPERATOR', tenantId: 'tenant-1', isActive: true } });
    tx.rolePermission.findUnique.mockResolvedValue({ roleCode: 'OPERATOR', permissionCode: 'TASK_CONTROL' });
    client.publishAsync.mockImplementation(async () => { expect(transactionActive).toBe(false); }); tx.outboxMessage.update.mockResolvedValue({}); tx.command.update.mockResolvedValue({}); prisma.outboxMessage.update.mockResolvedValue({});
  });

  it('publishes a normalized QoS 1 command and marks it SENT', async () => {
    await expect(service.publishNext(client as never)).resolves.toBe(true);
    expect(client.publishAsync).toHaveBeenCalledWith(`robots/${robotId}/commands`, expect.any(String), { qos: 1 });
    const sent = JSON.parse(client.publishAsync.mock.calls[0][1] as string);
    expect(sent).toEqual(expect.objectContaining({ schemaVersion: '1.0', robotId, commandId, sequence: expect.any(Number) }));
    expect(tx.command.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CommandStatus.SENT }) }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('releases the lease for retry when MQTT publication fails', async () => {
    client.publishAsync.mockRejectedValueOnce(new Error('broker unavailable'));
    await expect(service.publishNext(client as never)).rejects.toThrow('broker unavailable');
    expect(prisma.outboxMessage.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'outbox-1' }, data: expect.objectContaining({ availableAt: expect.any(Date) }) }));
  });

  it('rejects a command when the outbox topic does not match ownership', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'outbox-1', aggregateId: commandId, topic: 'robots/other/commands', payload: {}, attempts: 0 }]);
    await service.publishNext(client as never);
    expect(client.publishAsync).not.toHaveBeenCalled();
    expect(tx.command.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CommandStatus.FAILED, failureCode: 'COMMAND_SAFETY_GUARD' }) }));
  });

  it('marks unacknowledged SENT commands as TIMEOUT', async () => {
    prisma.command.updateMany.mockResolvedValue({ count: 1 });
    await service.markAckTimeouts(10_000);
    expect(prisma.command.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: CommandStatus.TIMEOUT, failureCode: 'ACK_TIMEOUT' }) }));
  });
});
