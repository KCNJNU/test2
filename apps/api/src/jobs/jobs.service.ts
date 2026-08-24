import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, JobStepStatus, JobType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';

const STEPS: Record<JobType, string[]> = {
  DATASET_PUBLISH: ['Validation', 'Workspace Snapshot', 'DVC Add', 'DVC Push', 'Git Commit/Tag', 'Recovery Check', 'Persist Version'],
  RECOVERY_VERIFY: ['Prepare Temporary Workspace', 'Checkout Git Tag', 'DVC Pull', 'Verify Manifest and Files', 'Cleanup'],
  STORAGE_SCAN: ['Load Database Index', 'List ObjectStorage', 'Compare Objects', 'Persist Issues'],
  STORAGE_ORPHAN_DELETE: ['Validate Issues', 'Delete Objects', 'Resolve Issues'],
  UPLOAD_FINALIZE: ['Validate Parts', 'Compose Object', 'Verify Format and Checksum', 'Create RobotFile', 'Cleanup Parts'],
  RETENTION_CLEANUP: ['Validate Recovery Gates', 'Delete Expired Data', 'Persist Audit Evidence'],
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}
  create(type: JobType, input: { payload: Prisma.InputJsonValue; resourceType?: string; resourceId?: string; requestedById?: string; tenantId?: string | null; projectId?: string | null; maxAttempts?: number }) { return this.prisma.job.create({ data: { type, payload: input.payload, resourceType: input.resourceType, resourceId: input.resourceId, requestedById: input.requestedById, tenantId: input.tenantId ?? undefined, projectId: input.projectId ?? undefined, maxAttempts: input.maxAttempts ?? 3, steps: { create: STEPS[type].map((name, stepOrder) => ({ name, stepOrder })) } }, include: { steps: { orderBy: { stepOrder: 'asc' } }, requestedBy: { select: { id: true, displayName: true, email: true } } } }); }
  async page(query: { page: number; pageSize: number; status?: JobStatus; type?: JobType; search?: string; requestedById?: string }, actor: UserRole | AuthUser) { const role=typeof actor==='string'?actor:actor.role; const where: Prisma.JobWhereInput = { status: query.status, type: query.type, ...this.scope(actor), ...(role === UserRole.VIEWER && { requestedById: query.requestedById }), ...(query.search && { OR: [{ resourceType: { contains: query.search, mode: 'insensitive' } }, { resourceId: { contains: query.search, mode: 'insensitive' } }, { errorMessage: { contains: query.search, mode: 'insensitive' } }] }) }; const [items, total] = await this.prisma.$transaction([this.prisma.job.findMany({ where, include: { requestedBy: { select: { id: true, displayName: true, email: true } }, steps: { orderBy: { stepOrder: 'asc' } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), this.prisma.job.count({ where })]); return { items, total, page: query.page, pageSize: query.pageSize }; }
  async get(id: string) { const job = await this.prisma.job.findUnique({ where: { id }, include: { requestedBy: { select: { id: true, displayName: true, email: true } }, steps: { orderBy: { stepOrder: 'asc' } } } }); if (!job) throw new NotFoundException('Job not found'); return job; }
  async getScoped(id: string, user: AuthUser) { const job=await this.prisma.job.findFirst({ where:{id,...this.scope(user)}, include:{requestedBy:{select:{id:true,displayName:true,email:true}},steps:{orderBy:{stepOrder:'asc'}}} });if(!job)throw new NotFoundException('Job not found');return job; }
  async retry(id: string, user?: AuthUser) { const job = user?await this.getScoped(id,user):await this.get(id); if (job.status !== JobStatus.FAILED) throw new ConflictException('Only FAILED jobs can be retried'); await this.prisma.$transaction([this.prisma.jobStep.updateMany({ where: { jobId: id, status: JobStepStatus.FAILED }, data: { status: JobStepStatus.PENDING, errorMessage: null, startedAt: null, finishedAt: null } }), this.prisma.job.update({ where: { id }, data: { status: JobStatus.QUEUED, errorCode: null, errorMessage: null, availableAt: new Date(), lockedAt: null, lockedBy: null, cancelRequested: false, finishedAt: null } })]); return user?this.getScoped(id,user):this.get(id); }
  async cancel(id: string, user?: AuthUser) { const job = user?await this.getScoped(id,user):await this.get(id); if (job.status !== JobStatus.QUEUED && job.status !== JobStatus.RUNNING) throw new ConflictException('Job cannot be cancelled'); if (job.status === JobStatus.QUEUED) await this.prisma.job.update({ where: { id }, data: { status: JobStatus.CANCELLED, cancelRequested: true, finishedAt: new Date() } }); else await this.prisma.job.update({ where: { id }, data: { cancelRequested: true } }); return user?this.getScoped(id,user):this.get(id); }
  async claim(workerId: string) {
    await this.recoverStale();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidate AS (
        SELECT id FROM "Job" WHERE status = 'QUEUED'::"JobStatus" AND "availableAt" <= NOW()
        ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE "Job" SET status = 'RUNNING'::"JobStatus", "lockedBy" = ${workerId}, "lockedAt" = NOW(), "heartbeatAt" = NOW(), "startedAt" = COALESCE("startedAt", NOW()), attempts = attempts + 1, "updatedAt" = NOW()
      WHERE id IN (SELECT id FROM candidate) RETURNING id
    `);
    return rows[0] ? this.get(rows[0].id) : null;
  }
  heartbeat(id: string, workerId: string) { return this.prisma.job.updateMany({ where: { id, lockedBy: workerId, status: JobStatus.RUNNING }, data: { heartbeatAt: new Date() } }); }
  async beginStep(jobId: string, name: string) { const step = await this.prisma.jobStep.findUnique({ where: { jobId_name: { jobId, name } } }); if (!step) throw new BadRequestException(`Unknown job step ${name}`); if (step.status === JobStepStatus.SUCCEEDED) return false; await this.prisma.jobStep.update({ where: { id: step.id }, data: { status: JobStepStatus.RUNNING, startedAt: new Date(), errorMessage: null } }); return true; }
  async completeStep(jobId: string, name: string, output?: Prisma.InputJsonValue) { const steps = await this.prisma.jobStep.findMany({ where: { jobId }, orderBy: { stepOrder: 'asc' } }); const step = steps.find((item) => item.name === name); if (!step) throw new BadRequestException(`Unknown job step ${name}`); await this.prisma.jobStep.update({ where: { id: step.id }, data: { status: JobStepStatus.SUCCEEDED, progress: 100, output, finishedAt: new Date() } }); const succeeded = steps.filter((item) => item.status === JobStepStatus.SUCCEEDED || item.id === step.id).length; await this.prisma.job.update({ where: { id: jobId }, data: { progress: Math.round(succeeded / steps.length * 100) } }); }
  async finish(id: string, result?: Prisma.InputJsonValue) { const job = await this.prisma.job.update({ where: { id }, data: { status: JobStatus.SUCCEEDED, progress: 100, result, finishedAt: new Date(), lockedBy: null, lockedAt: null, heartbeatAt: null }, include: { requestedBy: true } }); if (job.requestedById) await this.prisma.notification.create({ data: { userId: job.requestedById, jobId: id, type: 'JOB_SUCCEEDED', title: `${job.type.replaceAll('_', ' ')} completed`, message: 'The operation completed successfully.', resourceUrl: `/jobs/${id}` } }); return job; }
  async fail(id: string, error: unknown, stepName?: string, infrastructure = false) { const job = await this.prisma.job.findUniqueOrThrow({ where: { id } }); const message = error instanceof Error ? error.message : 'Job failed'; if (stepName) await this.prisma.jobStep.updateMany({ where: { jobId: id, name: stepName }, data: { status: JobStepStatus.FAILED, errorMessage: message, finishedAt: new Date() } }); const retry = infrastructure && job.attempts < job.maxAttempts; const delays = [5_000, 30_000, 120_000]; await this.prisma.job.update({ where: { id }, data: retry ? { status: JobStatus.QUEUED, errorCode: 'INFRASTRUCTURE_ERROR', errorMessage: message, availableAt: new Date(Date.now() + delays[Math.min(job.attempts - 1, delays.length - 1)]), lockedBy: null, lockedAt: null, heartbeatAt: null } : { status: JobStatus.FAILED, errorCode: infrastructure ? 'INFRASTRUCTURE_ERROR' : 'BUSINESS_ERROR', errorMessage: message, finishedAt: new Date(), lockedBy: null, lockedAt: null, heartbeatAt: null } }); if (!retry && job.requestedById) await this.prisma.notification.create({ data: { userId: job.requestedById, jobId: id, type: 'JOB_FAILED', title: `${job.type.replaceAll('_', ' ')} failed`, message, resourceUrl: `/jobs/${id}` } }); }
  async isCancelRequested(id: string) { return (await this.prisma.job.findUnique({ where: { id }, select: { cancelRequested: true } }))?.cancelRequested ?? true; }
  async markCancelled(id: string) { await this.prisma.job.update({ where: { id }, data: { status: JobStatus.CANCELLED, finishedAt: new Date(), lockedBy: null, lockedAt: null, heartbeatAt: null } }); }
  async acquireLease(key: string, owner: string, ttlMs = 70_000) {
    const expiresAt = new Date(Date.now() + ttlMs);
    const rows = await this.prisma.$queryRaw<Array<{ key: string }>>(Prisma.sql`
      INSERT INTO "JobLease" (key, owner, "expiresAt", "heartbeatAt", "updatedAt")
      VALUES (${key}, ${owner}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET owner = EXCLUDED.owner, "expiresAt" = EXCLUDED."expiresAt", "heartbeatAt" = NOW(), "updatedAt" = NOW()
      WHERE "JobLease"."expiresAt" < NOW() OR "JobLease".owner = ${owner}
      RETURNING key
    `);
    return rows.length === 1;
  }
  async heartbeatLease(key: string, owner: string, ttlMs = 70_000) { return this.prisma.jobLease.updateMany({ where: { key, owner }, data: { heartbeatAt: new Date(), expiresAt: new Date(Date.now() + ttlMs) } }); }
  async releaseLease(key: string, owner: string) { await this.prisma.jobLease.deleteMany({ where: { key, owner } }); }
  private async recoverStale() { await this.prisma.job.updateMany({ where: { status: JobStatus.RUNNING, heartbeatAt: { lt: new Date(Date.now() - 60_000) } }, data: { status: JobStatus.QUEUED, lockedBy: null, lockedAt: null, heartbeatAt: null, availableAt: new Date() } }); }
  private scope(actor: UserRole | AuthUser): Prisma.JobWhereInput { if(typeof actor==='string'||actor.role===UserRole.ADMIN||actor.role===UserRole.SUPER_ADMIN)return{};if(actor.role===UserRole.VIEWER)return{requestedById:actor.id};return{tenantId:actor.tenantId??'__NO_TENANT__',...(actor.role===UserRole.TENANT_ADMIN?{}:{projectId:{in:actor.projectIds}})}; }
}
