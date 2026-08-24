import { ConflictException } from '@nestjs/common';
import { DatasetVersionStatus } from '@prisma/client';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { DatasetPublishService } from './dataset-publish.service';

const checksum = (content: Buffer) => createHash('sha256').update(content).digest('hex');

describe('DatasetPublishService', () => {
  const manifest = Buffer.from('{"datasetId":"dataset-id","version":1,"createdAt":"2026-08-12T00:00:00.000Z","files":[]}\n');
  const raw = Buffer.from('{"ok":true}');
  const prisma = { datasetVersion: { findUnique: jest.fn(), update: jest.fn() } };
  const storage = { getObject: jest.fn() };
  const dvc = { publish: jest.fn(), checkRemoteHealth: jest.fn(), resolveWorkspace: jest.fn((path: string) => path) };
  const service = new DatasetPublishService(prisma as never, storage as never, dvc as never);
  const frozen = { id: 'version-id', status: DatasetVersionStatus.FROZEN, manifestKey: 'manifests/dataset-id/v1/manifest.json', manifestChecksum: checksum(manifest), dataset: { name: 'nightly scan' }, version: 1, files: [{ robotFile: { id: 'file-id', objectKey: 'raw/CR-001/scan.json', originalName: 'scan.json', checksum: checksum(raw) } }] };

  beforeEach(() => { jest.clearAllMocks(); storage.getObject.mockImplementation(async (key: string) => Readable.from([key.startsWith('manifests/') ? manifest : raw])); dvc.publish.mockResolvedValue({ dvcPath: 'data/dataset-workspace/nightly-scan/1.dvc', dvcHash: 'dvc-hash', gitCommit: 'commit', gitTag: 'dataset-nightly-scan-v1.0.0' }); dvc.checkRemoteHealth.mockResolvedValue({ configured: true, reachable: true }); prisma.datasetVersion.update.mockResolvedValue({}); });

  it('downloads and validates frozen files before DVC publication', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(frozen);
    await service.publish('version-id');
    expect(dvc.publish).toHaveBeenCalledWith('data\\dataset-workspace\\nightly-scan\\1', 'nightly scan', 1, expect.any(Function));
    expect(prisma.datasetVersion.update).toHaveBeenCalledWith({ where: { id: 'version-id' }, data: expect.objectContaining({ status: DatasetVersionStatus.PUBLISHED, gitTag: 'dataset-nightly-scan-v1.0.0' }) });
    expect(dvc.checkRemoteHealth.mock.invocationCallOrder[0]).toBeLessThan(prisma.datasetVersion.update.mock.invocationCallOrder[0]);
  });

  it('rejects non-frozen versions before reading objects or invoking DVC', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue({ ...frozen, status: DatasetVersionStatus.DRAFT });
    await expect(service.publish('version-id')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(dvc.publish).not.toHaveBeenCalled();
  });

  it('keeps a version frozen when the DVC remote cannot be recovered', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(frozen);
    dvc.checkRemoteHealth.mockResolvedValue({ configured: true, reachable: false });

    await expect(service.publish('version-id')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.datasetVersion.update).not.toHaveBeenCalled();
  });

  it('revalidates manifest integrity and remote health for an already published version', async () => {
    const published = { ...frozen, status: DatasetVersionStatus.PUBLISHED, gitTag: 'dataset-nightly-scan-v1.0.0', dvcPath: 'data/dataset-workspace/nightly-scan/1.dvc' };
    prisma.datasetVersion.findUnique.mockResolvedValue(published);

    await expect(service.publish('version-id')).resolves.toBe(published);
    expect(dvc.checkRemoteHealth).toHaveBeenCalled();
    expect(dvc.publish).not.toHaveBeenCalled();
    expect(prisma.datasetVersion.update).not.toHaveBeenCalled();
  });
});
