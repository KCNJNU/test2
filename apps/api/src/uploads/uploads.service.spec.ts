import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UploadStatus, UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const content = Buffer.from('industrial resumable upload\n');
  const checksum = createHash('sha256').update(content).digest('hex');
  const session = {
    id: '00000000-0000-0000-0000-000000000010', ownerId: '00000000-0000-0000-0000-000000000020', robotId: '00000000-0000-0000-0000-000000000030',
    status: UploadStatus.UPLOADING, originalName: 'scan.log', fileType: 'log', mimeType: 'text/plain', fileSize: BigInt(content.length), checksum,
    recognitionType: 'acceptance', schemaVersion: '2.1', capturedAt: new Date('2026-08-16T00:00:00Z'), metadata: null,
    chunkSize: 8 * 1024 * 1024, totalParts: 1, maxFileSize: 2_147_483_648n, tempPrefix: 'uploads/session/parts/', finalObjectKey: null,
    robotFileId: null, errorMessage: null, expiresAt: new Date(Date.now() + 60_000), completedAt: null, createdAt: new Date(), updatedAt: new Date(),
    parts: [{ id: 'part', uploadSessionId: 'session', partNumber: 1, objectKey: 'uploads/session/parts/000001', size: content.length, checksum, createdAt: new Date() }],
  };
  const prisma = {
    uploadSession: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() }, uploadPart: { upsert: jest.fn() },
    robot: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() }, robotFile: { findUnique: jest.fn() }, job: { findFirst: jest.fn() }, $transaction: jest.fn(),
  };
  const jobs = { create: jest.fn() };
  const settings = { get: jest.fn().mockResolvedValue(2_147_483_648) };
  const storage = { putObject: jest.fn(), getObject: jest.fn(), deleteObject: jest.fn(), exists: jest.fn(), getPresignedDownloadUrl: jest.fn(), checkHealth: jest.fn(), statObject: jest.fn(), listObjects: jest.fn(), composeObject: jest.fn(), deleteObjects: jest.fn() };
  const service = new UploadsService(prisma as never, jobs as never, settings as never, storage);

  beforeEach(() => { jest.clearAllMocks(); prisma.uploadSession.findUnique.mockResolvedValue(session); prisma.uploadSession.update.mockResolvedValue(session); storage.exists.mockResolvedValue(false); });

  it('rejects a part when its SHA-256 does not match before ObjectStorage work', async () => {
    await expect(service.putPart(session.id, 1, `bytes 0-${content.length - 1}/${content.length}`, '0'.repeat(64), content, session.ownerId, UserRole.OPERATOR)).rejects.toBeInstanceOf(ConflictException);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('compensates the composed object when RobotFile persistence fails', async () => {
    prisma.robot.findUniqueOrThrow.mockResolvedValue({ externalId: 'CR-TEST' }); prisma.robotFile.findUnique.mockResolvedValue(null);
    storage.composeObject.mockResolvedValue(undefined); storage.getObject.mockResolvedValue(Readable.from([content])); storage.deleteObject.mockResolvedValue(undefined);
    const databaseError = new Error('database unavailable'); prisma.$transaction.mockRejectedValue(databaseError);
    await expect(service.finalize(session.id)).rejects.toBe(databaseError);
    const finalObjectKey = storage.composeObject.mock.calls[0][0] as string;
    expect(finalObjectKey).toMatch(/^raw\/CR-TEST\/2026\/08\/16\/.+\.log$/);
    expect(storage.deleteObject).toHaveBeenCalledWith(finalObjectKey);
    expect(prisma.uploadSession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: session.id }, data: expect.objectContaining({ status: UploadStatus.FAILED }) }));
  });

  it('aborts by deleting exactly the persisted temporary part keys', async () => {
    storage.deleteObjects.mockResolvedValue(undefined);
    await service.abort(session.id, session.ownerId, UserRole.OPERATOR);
    expect(storage.deleteObjects).toHaveBeenCalledWith(['uploads/session/parts/000001']);
    expect(prisma.uploadSession.update).toHaveBeenCalledWith({ where: { id: session.id }, data: { status: UploadStatus.ABORTED, errorMessage: null } });
  });

  it('allows SUPER_ADMIN to manage an upload session owned by another user', async () => {
    storage.deleteObjects.mockResolvedValue(undefined);
    await service.abort(session.id, '00000000-0000-0000-0000-000000000099', UserRole.SUPER_ADMIN);
    expect(storage.deleteObjects).toHaveBeenCalledWith(['uploads/session/parts/000001']);
  });

  it('does not grant another non-admin user access to an upload session', async () => {
    await expect(service.abort(session.id, '00000000-0000-0000-0000-000000000099', UserRole.OPERATOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it('returns the existing finalize job when a FINALIZING upload is retried', async () => {
    const existingJob = { id: 'existing-finalize-job', status: 'QUEUED', steps: [] };
    prisma.uploadSession.findUnique.mockResolvedValue({ ...session, status: UploadStatus.FINALIZING });
    prisma.job.findFirst.mockResolvedValue(existingJob);

    await expect(service.complete(session.id, session.ownerId, UserRole.OPERATOR)).resolves.toBe(existingJob);
    expect(jobs.create).not.toHaveBeenCalled();
  });
});
