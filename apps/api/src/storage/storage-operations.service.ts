import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JobType, Prisma, ReconciliationIssueStatus, ReconciliationIssueType, ReconciliationStatus, UploadStatus, UserRole } from '@prisma/client';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, ObjectStorage, StoredObject } from './object-storage';

@Injectable()
export class StorageOperationsService {
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService, @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  async pageObjects(prefix: string | undefined, cursor: string | undefined, limit: number) {
    const result = await this.storage.listObjects({ prefix, cursor, limit });
    const keys = result.items.map((item) => item.objectKey);
    const [files, versions] = await Promise.all([
      this.prisma.robotFile.findMany({ where: { objectKey: { in: keys } }, select: { id: true, objectKey: true, originalName: true } }),
      this.prisma.datasetVersion.findMany({ where: { manifestKey: { in: keys } }, select: { id: true, manifestKey: true, version: true, dataset: { select: { id: true, name: true } } } }),
    ]);
    const fileMap = new Map(files.map((item) => [item.objectKey, item]));
    const manifestMap = new Map(versions.filter((item) => item.manifestKey).map((item) => [item.manifestKey as string, item]));
    return { ...result, items: result.items.map((item) => ({ ...item, mapping: fileMap.has(item.objectKey) ? { type: 'RobotFile', ...fileMap.get(item.objectKey) } : manifestMap.has(item.objectKey) ? { type: 'Manifest', ...manifestMap.get(item.objectKey) } : null })) };
  }

  async enqueueScan(userId: string) {
    const run = await this.prisma.reconciliationRun.create({ data: { requestedById: userId } });
    const job = await this.jobs.create(JobType.STORAGE_SCAN, { payload: { runId: run.id }, resourceType: 'ReconciliationRun', resourceId: run.id, requestedById: userId });
    await this.prisma.reconciliationRun.update({ where: { id: run.id }, data: { jobId: job.id } });
    return { run: { ...run, jobId: job.id }, job };
  }

  async enqueueOrphanDelete(userId: string, role: UserRole, issueIds: string[], confirmation: string) {
    if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) throw new ForbiddenException('Only Super Admin can delete orphan objects');
    if (confirmation !== 'DELETE_ORPHAN_OBJECTS') throw new BadRequestException('Explicit orphan deletion confirmation is required');
    const issues = await this.prisma.reconciliationIssue.findMany({ where: { id: { in: issueIds }, type: ReconciliationIssueType.ORPHAN_OBJECT, status: ReconciliationIssueStatus.OPEN } });
    if (issues.length !== new Set(issueIds).size) throw new BadRequestException('Every issue must be an open orphan object issue');
    return this.jobs.create(JobType.STORAGE_ORPHAN_DELETE, { payload: { issueIds }, resourceType: 'ReconciliationIssue', requestedById: userId, maxAttempts: 3 });
  }

  pageRuns(page: number, pageSize: number) { return this.prisma.$transaction(async (tx) => ({ items: await tx.reconciliationRun.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { requestedBy: { select: { id: true, displayName: true } } } }), total: await tx.reconciliationRun.count(), page, pageSize })); }
  async getRun(id: string) { const run = await this.prisma.reconciliationRun.findUnique({ where: { id }, include: { issues: { orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] } } }); if (!run) throw new NotFoundException('Reconciliation run not found'); return this.serializeRun(run); }
  async ignoreIssue(id: string, note?: string) { try { return await this.prisma.reconciliationIssue.update({ where: { id }, data: { status: ReconciliationIssueStatus.IGNORED, resolutionNote: note, resolvedAt: new Date() } }); } catch { throw new NotFoundException('Reconciliation issue not found'); } }

  async executeScan(runId: string) {
    const run = await this.prisma.reconciliationRun.update({ where: { id: runId }, data: { status: ReconciliationStatus.RUNNING, startedAt: new Date(), errorMessage: null } });
    try {
      const [files, versions, activeUploads] = await Promise.all([
        this.prisma.robotFile.findMany({ select: { id: true, objectKey: true, fileSize: true } }),
        this.prisma.datasetVersion.findMany({ where: { manifestKey: { not: null } }, select: { id: true, manifestKey: true } }),
        this.prisma.uploadSession.findMany({ where: { status: { in: [UploadStatus.CREATED, UploadStatus.UPLOADING, UploadStatus.FINALIZING] }, expiresAt: { gt: new Date() } }, select: { tempPrefix: true } }),
      ]);
      const expected = new Map<string, { robotFileId?: string; size?: bigint }>();
      for (const file of files) expected.set(file.objectKey, { robotFileId: file.id, size: file.fileSize });
      for (const version of versions) if (version.manifestKey) expected.set(version.manifestKey, {});
      const objects = await this.listAllObjects();
      const objectMap = new Map(objects.map((item) => [item.objectKey, item]));
      const issues: Prisma.ReconciliationIssueCreateManyInput[] = [];
      for (const [objectKey, metadata] of expected) {
        const actual = objectMap.get(objectKey);
        if (!actual) issues.push({ runId, type: ReconciliationIssueType.MISSING_OBJECT, objectKey, robotFileId: metadata.robotFileId, expectedSize: metadata.size });
        else if (metadata.size !== undefined && BigInt(actual.size) !== metadata.size) issues.push({ runId, type: ReconciliationIssueType.SIZE_MISMATCH, objectKey, robotFileId: metadata.robotFileId, expectedSize: metadata.size, actualSize: BigInt(actual.size) });
      }
      const tempPrefixes = activeUploads.map((item) => item.tempPrefix);
      for (const item of objects) if (!expected.has(item.objectKey) && !tempPrefixes.some((prefix) => item.objectKey.startsWith(prefix))) issues.push({ runId, type: ReconciliationIssueType.ORPHAN_OBJECT, objectKey: item.objectKey, actualSize: BigInt(item.size) });
      await this.prisma.$transaction(async (tx) => {
        await tx.reconciliationIssue.deleteMany({ where: { runId } });
        if (issues.length) await tx.reconciliationIssue.createMany({ data: issues });
        await tx.reconciliationRun.update({ where: { id: runId }, data: { status: ReconciliationStatus.COMPLETED, scannedObjects: objects.length, indexedObjects: expected.size, issueCount: issues.length, completedAt: new Date() } });
      });
      if (issues.length && run.requestedById) await this.prisma.notification.create({ data: { userId: run.requestedById, type: 'RECONCILIATION_ISSUES', title: 'Storage reconciliation found issues', message: `${issues.length} storage issue(s) require review.`, resourceUrl: `/storage?run=${runId}` } });
      return { runId, scannedObjects: objects.length, indexedObjects: expected.size, issueCount: issues.length };
    } catch (error) {
      await this.prisma.reconciliationRun.update({ where: { id: runId }, data: { status: ReconciliationStatus.FAILED, errorMessage: error instanceof Error ? error.message : 'Storage scan failed', completedAt: new Date() } });
      throw error;
    }
  }

  async executeOrphanDelete(issueIds: string[]) {
    const issues = await this.prisma.reconciliationIssue.findMany({ where: { id: { in: issueIds }, type: ReconciliationIssueType.ORPHAN_OBJECT, status: ReconciliationIssueStatus.OPEN } });
    if (issues.length !== new Set(issueIds).size) throw new BadRequestException('Orphan issues changed before deletion');
    await this.storage.deleteObjects(issues.map((issue) => issue.objectKey));
    await this.prisma.reconciliationIssue.updateMany({ where: { id: { in: issueIds } }, data: { status: ReconciliationIssueStatus.RESOLVED, resolutionNote: 'Confirmed orphan object deletion', resolvedAt: new Date() } });
    return { deleted: issues.length, objectKeys: issues.map((issue) => issue.objectKey) };
  }

  private async listAllObjects() { const items: StoredObject[] = []; let cursor: string | undefined; do { const page = await this.storage.listObjects({ cursor, limit: 1000 }); items.push(...page.items); cursor = page.nextCursor; } while (cursor); return items; }
  private serializeRun<T extends { issues: Array<{ expectedSize: bigint | null; actualSize: bigint | null }> }>(run: T) { return { ...run, issues: run.issues.map((issue) => ({ ...issue, expectedSize: issue.expectedSize?.toString() ?? null, actualSize: issue.actualSize?.toString() ?? null })) }; }
}
