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
  const dvc = { publish: jest.fn() };
  const service = new DatasetPublishService(prisma as never, storage as never, dvc as never);
  const frozen = { id: 'version-id', status: DatasetVersionStatus.FROZEN, manifestKey: 'manifests/dataset-id/v1/manifest.json', manifestChecksum: checksum(manifest), dataset: { name: 'nightly scan' }, version: 1, files: [{ robotFile: { id: 'file-id', objectKey: 'raw/CR-001/scan.json', originalName: 'scan.json', checksum: checksum(raw) } }] };

  beforeEach(() => { jest.clearAllMocks(); storage.getObject.mockImplementation(async (key: string) => Readable.from([key.startsWith('manifests/') ? manifest : raw])); dvc.publish.mockResolvedValue({ dvcPath: 'data/dataset-workspace/nightly-scan/1.dvc', dvcHash: 'dvc-hash', gitCommit: 'commit', gitTag: 'dataset-nightly-scan-v1.0.0' }); prisma.datasetVersion.update.mockResolvedValue({}); });

  it('downloads and validates frozen files before DVC publication', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue(frozen);
    await service.publish('version-id');
    expect(dvc.publish).toHaveBeenCalledWith('data\\dataset-workspace\\nightly-scan\\1', 'nightly scan', 1);
    expect(prisma.datasetVersion.update).toHaveBeenCalledWith({ where: { id: 'version-id' }, data: expect.objectContaining({ status: DatasetVersionStatus.PUBLISHED, gitTag: 'dataset-nightly-scan-v1.0.0' }) });
  });

  it('rejects non-frozen versions before reading objects or invoking DVC', async () => {
    prisma.datasetVersion.findUnique.mockResolvedValue({ ...frozen, status: DatasetVersionStatus.DRAFT });
    await expect(service.publish('version-id')).rejects.toBeInstanceOf(ConflictException);
    expect(storage.getObject).not.toHaveBeenCalled();
    expect(dvc.publish).not.toHaveBeenCalled();
  });
});
