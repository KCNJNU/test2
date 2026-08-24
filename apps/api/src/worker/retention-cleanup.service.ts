import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage } from '../storage/object-storage';

@Injectable()
export class RetentionCleanupService {
  constructor(private readonly prisma: PrismaService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async execute(requestedById?: string | null) {
    const now = Date.now();
    const before = (days: number) => new Date(now - days * 86_400_000);
    const diagnostic = await this.prisma.diagnosticBundle.findMany({ where: { createdAt: { lt: before(90) } }, select: { id: true, objectKey: true }, take: 5_000 });
    let diagnosticsDeleted = 0;
    for (const item of diagnostic) {
      await this.storage.deleteObject(item.objectKey);
      await this.prisma.diagnosticBundle.delete({ where: { id: item.id } });
      diagnosticsDeleted += 1;
    }
    const taskIds = (await this.prisma.task.findMany({ where: { createdAt: { lt: before(365) }, status: { in: ['COMPLETED', 'FAILED', 'CANCELED'] } }, select: { id: true }, take: 5_000 })).map(({ id }) => id);
    const result = await this.prisma.$transaction(async (tx) => {
      const telemetry = await tx.telemetrySample.deleteMany({ where: { receivedAt: { lt: before(30) } } });
      const healthAggregates = await tx.robotHealthSnapshot.deleteMany({ where: { receivedAt: { lt: before(365) } } });
      const faults = await tx.faultEvent.deleteMany({ where: { createdAt: { lt: before(365) }, endAt: { not: null } } });
      if (taskIds.length) {
        await tx.robot.updateMany({ where: { currentTaskId: { in: taskIds } }, data: { currentTaskId: null } });
        await tx.taskEvent.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskRun.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.command.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      const audit = await tx.auditLog.deleteMany({ where: { createdAt: { lt: before(730) } } });
      return { telemetry: telemetry.count, telemetryAggregates: healthAggregates.count, faults: faults.count, tasks: taskIds.length, auditLogs: audit.count };
    });
    const evidence = { ...result, diagnostics: diagnosticsDeleted, policyVersion: 'D6-2026-08', completedAt: new Date().toISOString() };
    await this.prisma.auditLog.create({ data: { actorUserId: requestedById ?? undefined, action: 'RETENTION_POLICY_APPLIED', resourceType: 'RetentionPolicy', resourceId: 'D6-2026-08', metadata: evidence as Prisma.InputJsonValue } });
    return evidence;
  }
}
