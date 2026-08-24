import { Injectable, Logger } from '@nestjs/common';
import { CommandStatus, Prisma } from '@prisma/client';
import type { MqttClient } from 'mqtt';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';

type OutboxRow = { id: string; aggregateId: string; topic: string; payload: unknown; attempts: number };

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);
  constructor(private readonly prisma: PrismaService) {}

  async publishNext(client: MqttClient): Promise<boolean> {
    const claim = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
        SELECT id, "aggregateId", topic, payload, attempts
        FROM "OutboxMessage"
        WHERE "publishedAt" IS NULL AND "availableAt" <= NOW()
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const outbox = rows[0];
      if (!outbox) return null;
      const command = UUID.test(outbox.aggregateId)
        ? await tx.command.findUnique({ where: { id: outbox.aggregateId }, include: { robot: true, createdBy: true } })
        : null;
      const expectedTopic = command ? `robots/${command.robotId}/commands` : undefined;
      const permission = command ? permissionFor(command.type) : undefined;
      const permitted = command && permission ? await tx.rolePermission.findUnique({
        where: { roleCode_permissionCode: { roleCode: command.createdBy.role, permissionCode: permission } },
      }) : null;
      const tenantMatches = command?.createdBy.role === 'SUPER_ADMIN' || command?.createdBy.role === 'ADMIN'
        || command?.robot.tenantId === command?.createdBy.tenantId;
      if (!command || !command.robot?.externalId || !command.createdBy.isActive || !permitted || !tenantMatches || outbox.topic !== expectedTopic) {
        if (command) await tx.command.update({ where: { id: command.id }, data: {
          status: CommandStatus.FAILED, finishedAt: new Date(), failureCode: 'COMMAND_SAFETY_GUARD', failureMessage: 'Command ownership or topic validation failed',
        } });
        await tx.outboxMessage.update({ where: { id: outbox.id }, data: { publishedAt: new Date(), attempts: { increment: 1 } } });
        this.logger.error(`Rejected outbox ${outbox.id}: command safety guard failed`);
        return { handled: true as const };
      }
      const original = record(outbox.payload);
      const now = Date.now();
      const envelope = {
        ...original,
        schemaVersion: '1.0',
        messageId: typeof original.messageId === 'string' ? original.messageId : `CMD-${command.id}`,
        robotId: command.robotId,
        commandId: command.id,
        traceId: typeof original.traceId === 'string' && /^[0-9a-f]{32}$/i.test(original.traceId)
          ? original.traceId.toLowerCase()
          : createHash('sha256').update(typeof original.messageId === 'string' ? original.messageId : command.id).digest('hex').slice(0, 32),
        robotSn: command.robot.externalId,
        timestamp: typeof original.timestamp === 'number' ? original.timestamp : now,
        sequence: typeof original.sequence === 'number' || typeof original.sequence === 'string' ? original.sequence : now,
        type: command.type,
        payload: record(original.payload ?? command.payload),
      };
      await tx.outboxMessage.update({ where: { id: outbox.id }, data: {
        attempts: { increment: 1 }, availableAt: new Date(Date.now() + 30_000),
      } });
      return { handled: false as const, outboxId: outbox.id, commandId: command.id, topic: outbox.topic, envelope };
    }, { timeout: 5_000 });

    if (!claim) return false;
    if (claim.handled) return true;
    try {
      await client.publishAsync(claim.topic, JSON.stringify(claim.envelope), { qos: 1 });
      await this.prisma.$transaction(async (tx) => {
        await tx.outboxMessage.update({ where: { id: claim.outboxId }, data: { publishedAt: new Date() } });
        await tx.command.update({ where: { id: claim.commandId }, data: { status: CommandStatus.SENT, sentAt: new Date(), failureCode: null, failureMessage: null } });
      });
      return true;
    } catch (error) {
      await this.prisma.outboxMessage.update({ where: { id: claim.outboxId }, data: {
        availableAt: new Date(Date.now() + 2_000),
      } }).catch(() => undefined);
      throw error;
    }
  }

  async markAckTimeouts(timeoutMs: number) {
    const deadline = new Date(Date.now() - timeoutMs);
    return this.prisma.command.updateMany({
      where: { status: CommandStatus.SENT, sentAt: { lt: deadline } },
      data: { status: CommandStatus.TIMEOUT, finishedAt: new Date(), failureCode: 'ACK_TIMEOUT', failureMessage: 'Robot did not acknowledge the command before the deadline' },
    });
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function permissionFor(type: string) {
  if (type === 'SOFTWARE_UPDATE') return 'OTA_MANAGE';
  if (type === 'CONFIG_APPLY') return 'CONFIG_SAFETY_MANAGE';
  return 'TASK_CONTROL';
}
